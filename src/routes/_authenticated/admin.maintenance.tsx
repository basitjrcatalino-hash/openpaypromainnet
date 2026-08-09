import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  listFeatureFlags,
  setAllFeatureFlags,
  updateFeatureFlag,
} from "@/lib/feature-flags.functions";
import { checkIsAdmin } from "@/lib/topup-admin.functions";
import type { FeatureFlag } from "@/lib/feature-flags";
import { FEATURE_FLAGS_QUERY_KEY } from "@/lib/feature-flags";

export const Route = createFileRoute("/_authenticated/admin/maintenance")({
  head: () => ({
    meta: [
      { title: "Maintenance Control — OpenPay Pro Admin" },
      {
        name: "description",
        content: "Turn any OpenPay Pro feature on or off and put it into maintenance mode.",
      },
    ],
  }),
  component: AdminMaintenancePage,
});

function AdminMaintenancePage() {
  const qc = useQueryClient();
  const isAdminFn = useServerFn(checkIsAdmin);
  const listFn = useServerFn(listFeatureFlags);
  const updateFn = useServerFn(updateFeatureFlag);
  const bulkFn = useServerFn(setAllFeatureFlags);

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdminFn() });
  const flagsQ = useQuery({
    queryKey: ["admin-feature-flags"],
    queryFn: () => listFn() as Promise<FeatureFlag[]>,
    enabled: !!adminQ.data?.isAdmin,
  });

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-feature-flags"] });
    void qc.invalidateQueries({ queryKey: FEATURE_FLAGS_QUERY_KEY });
  };

  const update = useMutation({
    mutationFn: (v: { feature_key: string; enabled?: boolean; message?: string | null }) =>
      updateFn({ data: v }),
    onSuccess: () => {
      invalidate();
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: (v: { enabled: boolean; group?: string }) => bulkFn({ data: v }),
    onSuccess: () => {
      invalidate();
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const groups = useMemo(() => {
    const rows = (flagsQ.data ?? []).filter((f) => f.feature_key !== "global");
    const map = new Map<string, FeatureFlag[]>();
    for (const f of rows) {
      const arr = map.get(f.feature_group) ?? [];
      arr.push(f);
      map.set(f.feature_group, arr);
    }
    return [...map.entries()];
  }, [flagsQ.data]);

  const global = (flagsQ.data ?? []).find((f) => f.feature_key === "global");

  if (adminQ.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!adminQ.data?.isAdmin) {
    return (
      <div className="mx-auto max-w-md space-y-3 px-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-500" />
        <h1 className="text-lg font-bold">Admins only</h1>
        <p className="text-sm text-muted-foreground">
          You need the admin role to control feature maintenance.
        </p>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-24">
      <div className="space-y-2">
        <Badge variant="secondary" className="rounded-full">
          Admin
        </Badge>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
          <Wrench className="h-6 w-6 text-primary" />
          Maintenance control
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Switch any feature off to show a maintenance screen to all users. Admins keep full access
          so you can keep working while a feature is down.
        </p>
      </div>

      {/* Global */}
      <section className="space-y-3 rounded-3xl border border-amber-500/40 bg-amber-500/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Global maintenance</h2>
            <p className="text-xs text-muted-foreground">
              Turns off every feature at once (Settings and Admin stay open).
            </p>
          </div>
          <Switch
            checked={!global?.enabled}
            disabled={!global || update.isPending}
            onCheckedChange={(on) => update.mutate({ feature_key: "global", enabled: !on })}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-10 max-w-sm rounded-xl"
            placeholder="Maintenance message shown to users"
            value={drafts["global"] ?? global?.message ?? ""}
            onChange={(e) => setDrafts((d) => ({ ...d, global: e.target.value }))}
          />
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() =>
              update.mutate({ feature_key: "global", message: drafts["global"] ?? "" })
            }
          >
            Save message
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          disabled={bulk.isPending}
          onClick={() => bulk.mutate({ enabled: true })}
        >
          Enable all features
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          disabled={bulk.isPending}
          onClick={() => bulk.mutate({ enabled: false })}
        >
          Disable all features
        </Button>
      </div>

      {flagsQ.isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        groups.map(([group, rows]) => (
          <section key={group} className="space-y-3 rounded-3xl border border-border/60 bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold">{group}</h2>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-xs"
                  onClick={() => bulk.mutate({ enabled: true, group })}
                >
                  All on
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-xs"
                  onClick={() => bulk.mutate({ enabled: false, group })}
                >
                  All off
                </Button>
              </div>
            </div>
            <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50">
              {rows.map((f) => (
                <div key={f.id} className="space-y-2 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{f.label}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{f.path_prefix}</p>
                    </div>
                    <Badge
                      variant={f.enabled ? "secondary" : "outline"}
                      className="rounded-full text-[10px]"
                    >
                      {f.enabled ? "Live" : "Maintenance"}
                    </Badge>
                    <Switch
                      checked={f.enabled}
                      disabled={update.isPending}
                      onCheckedChange={(on) =>
                        update.mutate({ feature_key: f.feature_key, enabled: on })
                      }
                    />
                  </div>
                  {!f.enabled ? (
                    <div className="flex flex-wrap gap-2">
                      <Input
                        className="h-9 max-w-sm rounded-xl text-xs"
                        placeholder="Message for this feature (optional)"
                        value={drafts[f.feature_key] ?? f.message ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [f.feature_key]: e.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() =>
                          update.mutate({
                            feature_key: f.feature_key,
                            message: drafts[f.feature_key] ?? "",
                          })
                        }
                      >
                        Save
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
