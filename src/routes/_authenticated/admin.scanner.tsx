import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ScanLine, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { checkIsAdmin } from "@/lib/topup-admin.functions";
import {
  listScannerTargets,
  setAllScannerTargets,
  updateScannerTarget,
} from "@/lib/scanner-admin.functions";
import { SCAN_TARGETS_QUERY_KEY, type ScanTarget } from "@/lib/scan-targets";

export const Route = createFileRoute("/_authenticated/admin/scanner")({
  head: () => ({
    meta: [
      { title: "Scanner Control — OpenPay Pro Admin" },
      {
        name: "description",
        content:
          "Enable or disable each QR type the OpenPay Pro scanner accepts: OpenPay Pro, OpenPay, Pi Wallet, QR Ph and WalletConnect.",
      },
      { property: "og:title", content: "Scanner Control — OpenPay Pro Admin" },
      {
        property: "og:description",
        content: "Control which QR codes the OpenPay Pro scanner accepts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminScannerPage,
});

function AdminScannerPage() {
  const qc = useQueryClient();
  const isAdminFn = useServerFn(checkIsAdmin);
  const listFn = useServerFn(listScannerTargets);
  const updateFn = useServerFn(updateScannerTarget);
  const bulkFn = useServerFn(setAllScannerTargets);

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdminFn() });
  const rowsQ = useQuery({
    queryKey: ["admin-scanner-targets"],
    queryFn: () => listFn() as Promise<ScanTarget[]>,
    enabled: !!adminQ.data?.isAdmin,
  });

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-scanner-targets"] });
    void qc.invalidateQueries({ queryKey: SCAN_TARGETS_QUERY_KEY });
  };

  const update = useMutation({
    mutationFn: (v: { target_key: string; enabled?: boolean; message?: string | null }) =>
      updateFn({ data: v }),
    onSuccess: () => {
      invalidate();
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: (v: { enabled: boolean }) => bulkFn({ data: v }),
    onSuccess: () => {
      invalidate();
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
          You need the admin role to control the scanner.
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
          <ScanLine className="h-6 w-6 text-primary" />
          Scanner control
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Choose which QR codes the camera accepts. Turn one off and users scanning that code see
          your message instead of continuing.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          disabled={bulk.isPending}
          onClick={() => bulk.mutate({ enabled: true })}
        >
          Enable all
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          disabled={bulk.isPending}
          onClick={() => bulk.mutate({ enabled: false })}
        >
          Disable all
        </Button>
      </div>

      {rowsQ.isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="divide-y divide-border/40 overflow-hidden rounded-3xl border border-border/60 bg-card">
          {(rowsQ.data ?? []).map((t) => (
            <div key={t.id} className="space-y-2 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                <Badge
                  variant={t.enabled ? "secondary" : "outline"}
                  className="rounded-full text-[10px]"
                >
                  {t.enabled ? "On" : "Off"}
                </Badge>
                <Switch
                  checked={t.enabled}
                  disabled={update.isPending}
                  onCheckedChange={(on) => update.mutate({ target_key: t.target_key, enabled: on })}
                />
              </div>
              {!t.enabled ? (
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="h-9 max-w-sm rounded-xl text-xs"
                    placeholder="Message shown when this QR is scanned"
                    value={drafts[t.target_key] ?? t.message ?? ""}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [t.target_key]: e.target.value }))
                    }
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      update.mutate({
                        target_key: t.target_key,
                        message: drafts[t.target_key] ?? "",
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
      )}
    </div>
  );
}
