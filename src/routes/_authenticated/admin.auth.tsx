import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  checkIsAdmin,
  claimFirstAdmin,
  listAuthMethods,
  updateAuthMethod,
  ensureAuthMethods,
  setAllAuthMethodsEnabled,
} from "@/lib/auth-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/auth")({
  head: () => ({ meta: [{ title: "Admin · Auth methods" }] }),
  component: AdminAuthPage,
});

function AdminAuthPage() {
  const qc = useQueryClient();
  const check = useServerFn(checkIsAdmin);
  const claim = useServerFn(claimFirstAdmin);
  const listM = useServerFn(listAuthMethods);
  const saveMethod = useServerFn(updateAuthMethod);
  const ensureMethods = useServerFn(ensureAuthMethods);
  const setAll = useServerFn(setAllAuthMethodsEnabled);

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => check() });
  const isAdmin = !!adminQ.data?.isAdmin;

  const methodsQ = useQuery({
    queryKey: ["auth-methods-admin"],
    queryFn: async () => {
      await ensureMethods();
      return listM();
    },
    enabled: isAdmin,
  });

  const methodM = useMutation({
    mutationFn: (patch: {
      id: string;
      label?: string;
      description?: string | null;
      enabled?: boolean;
      sort_order?: number;
      maintenance_message?: string | null;
    }) => saveMethod({ data: patch }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["auth-methods-admin"] });
      void qc.invalidateQueries({ queryKey: ["auth-methods"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allM = useMutation({
    mutationFn: (enabled: boolean) => setAll({ data: { enabled } }),
    onSuccess: (_d, enabled) => {
      toast.success(enabled ? "All auth methods visible" : "All auth methods hidden");
      void qc.invalidateQueries({ queryKey: ["auth-methods-admin"] });
      void qc.invalidateQueries({ queryKey: ["auth-methods"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (adminQ.isLoading) {
    return (
      <div className="grid place-items-center p-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="mx-auto mt-10 max-w-md space-y-4 rounded-3xl border-border p-6 text-center shadow-none">
        <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-bold">Admin access required</h1>
        <p className="text-sm text-muted-foreground">
          Sign-in method toggles are limited to OpenPay Pro admins.
        </p>
        <Button
          type="button"
          className="rounded-full"
          onClick={() =>
            void claim()
              .then((r) => {
                if (r.claimed) {
                  toast.success("You are now admin");
                  void qc.invalidateQueries({ queryKey: ["is-admin"] });
                } else toast.error("An admin already exists");
              })
              .catch((e: Error) => toast.error(e.message))
          }
        >
          Claim first admin
        </Button>
      </Card>
    );
  }

  const rows = methodsQ.data ?? [];
  const enabledCount = rows.filter((m: { enabled: boolean }) => m.enabled).length;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-24 pt-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">Auth methods</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Show or hide each sign-in rail on{" "}
            <Link to="/authpi" className="font-semibold text-primary hover:underline">
              /authpi
            </Link>{" "}
            during maintenance. Off = hidden for everyone.
          </p>
        </div>
      </div>

      <Card className="space-y-3 rounded-2xl border-border p-4 shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {enabledCount} of {rows.length} visible
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={allM.isPending}
              onClick={() => allM.mutate(true)}
            >
              Enable all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="rounded-full"
              disabled={allM.isPending}
              onClick={() => allM.mutate(false)}
            >
              Hide all
            </Button>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 rounded-2xl border-border p-5 shadow-none">
        <h2 className="text-lg font-semibold">Sign-in methods</h2>
        <p className="text-sm text-muted-foreground">
          Toggle each method independently. Optional maintenance message shows if someone deep-links
          a disabled method.
        </p>
        {methodsQ.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !rows.length ? (
          <p className="text-sm text-muted-foreground">No methods configured.</p>
        ) : (
          <div className="space-y-3">
            {rows.map(
              (m: {
                id: string;
                method_key: string;
                label: string;
                description: string | null;
                enabled: boolean;
                sort_order: number;
                maintenance_message: string | null;
              }) => (
                <div key={m.id} className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                      {m.method_key}
                    </code>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {m.enabled ? "Visible" : "Hidden · maintenance"}
                      </span>
                      <Switch
                        checked={!!m.enabled}
                        onCheckedChange={(v) => methodM.mutate({ id: m.id, enabled: v })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_100px]">
                    <Input
                      defaultValue={m.label}
                      onBlur={(e) => {
                        const label = e.target.value.trim();
                        if (label && label !== m.label) methodM.mutate({ id: m.id, label });
                      }}
                      placeholder="Label"
                    />
                    <Input
                      type="number"
                      min={0}
                      defaultValue={m.sort_order}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n) && n !== m.sort_order)
                          methodM.mutate({ id: m.id, sort_order: Math.max(0, Math.round(n)) });
                      }}
                      placeholder="Order"
                    />
                  </div>
                  <Input
                    defaultValue={m.description ?? ""}
                    onBlur={(e) => {
                      const description = e.target.value.trim();
                      if (description !== (m.description ?? ""))
                        methodM.mutate({ id: m.id, description: description || null });
                    }}
                    placeholder="Description"
                  />
                  <Input
                    defaultValue={m.maintenance_message ?? ""}
                    onBlur={(e) => {
                      const maintenance_message = e.target.value.trim();
                      if (maintenance_message !== (m.maintenance_message ?? ""))
                        methodM.mutate({
                          id: m.id,
                          maintenance_message: maintenance_message || null,
                        });
                    }}
                    placeholder="Maintenance message (optional)"
                  />
                </div>
              ),
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
