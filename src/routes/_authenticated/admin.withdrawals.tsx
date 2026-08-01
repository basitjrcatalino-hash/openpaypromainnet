/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  Check,
  Copy,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QrScannerButton } from "@/components/qr-scanner";
import { copyText } from "@/lib/clipboard";
import { formatNumber, shortAddress, timeAgo } from "@/lib/wallet-utils";
import { checkIsAdmin, claimFirstAdmin } from "@/lib/topup-admin.functions";
import {
  listAdminWithdrawals,
  reviewOusdWithdrawal,
} from "@/lib/withdraw.functions";
import { extractAddressFromScan } from "@/lib/withdraw-ousd";

export const Route = createFileRoute("/_authenticated/admin/withdrawals")({
  head: () => ({ meta: [{ title: "Admin · Withdrawals" }] }),
  component: AdminWithdrawalsPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  completed: "default",
  rejected: "destructive",
  cancelled: "secondary",
};

function AdminWithdrawalsPage() {
  const qc = useQueryClient();
  const check = useServerFn(checkIsAdmin);
  const claim = useServerFn(claimFirstAdmin);
  const listW = useServerFn(listAdminWithdrawals);
  const review = useServerFn(reviewOusdWithdrawal);

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => check() });
  const isAdmin = !!adminQ.data?.isAdmin;

  const listQ = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: () => listW(),
    enabled: isAdmin,
    refetchInterval: 20_000,
  });

  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "rejected">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [scanMatch, setScanMatch] = useState("");

  const rows = useMemo(() => {
    const all = (listQ.data ?? []) as any[];
    if (filter === "all") return all;
    return all.filter((r) => r.status === filter);
  }, [listQ.data, filter]);

  const reviewM = useMutation({
    mutationFn: (payload: {
      id: string;
      action: "approve" | "reject";
      admin_note?: string | null;
      payout_tx_hash?: string | null;
    }) => review({ data: payload }),
    onSuccess: (_d, vars) => {
      toast.success(vars.action === "approve" ? "Marked successful" : "Rejected & refunded");
      void qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const claimM = useMutation({
    mutationFn: () => claim(),
    onSuccess: (r) => {
      if (r.claimed) toast.success("You are now admin");
      else toast.message("Admin already claimed");
      void qc.invalidateQueries({ queryKey: ["is-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function copyAddr(addr: string) {
    try {
      await copyText(addr);
      toast.success("Address copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  if (adminQ.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="mx-auto max-w-md space-y-4 p-6 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Admin only</h1>
        <p className="text-sm text-muted-foreground">
          Claim first admin if this is a fresh project, or sign in with an admin account.
        </p>
        <Button onClick={() => claimM.mutate()} disabled={claimM.isPending}>
          {claimM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Claim first admin
        </Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Withdrawals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review locked OUSD requests. Approve after you send to the user&apos;s Pi address, or
          reject to refund.
        </p>
      </div>

      <Card className="space-y-3 p-4">
        <Label>Scan / paste user destination to find request</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={scanMatch}
            onChange={(e) => setScanMatch(e.target.value.trim())}
            placeholder="Paste destination address"
            className="min-w-48 flex-1 font-mono text-sm"
          />
          <QrScannerButton
            hint="Scan user's withdrawal address QR"
            onResult={(text) => {
              const addr = extractAddressFromScan(text);
              setScanMatch(addr);
              setFilter("all");
              toast.success(addr ? "Address loaded" : "Empty scan");
            }}
            trigger={
              <Button type="button" variant="outline" className="gap-1.5">
                <Camera className="h-4 w-4" />
                Scan address
              </Button>
            }
          />
        </div>
        {scanMatch ? (
          <p className="text-xs text-muted-foreground">
            Filtering list for matches containing{" "}
            <span className="font-mono">{shortAddress(scanMatch, 10, 8)}</span>
          </p>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-2">
        {(["pending", "completed", "rejected", "all"] as const).map((f) => (
          <Button
            key={f}
            type="button"
            size="sm"
            variant={filter === f ? "default" : "outline"}
            className="rounded-full capitalize"
            onClick={() => setFilter(f)}
          >
            {f === "completed" ? "successful" : f}
          </Button>
        ))}
      </div>

      {listQ.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No {filter === "all" ? "" : filter} withdrawals.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows
            .filter((r) => {
              if (!scanMatch) return true;
              return String(r.destination_address || "")
                .toLowerCase()
                .includes(scanMatch.toLowerCase());
            })
            .map((r) => (
              <li key={r.id}>
                <Card className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-lg font-semibold tabular-nums">
                        {formatNumber(Number(r.amount), 2)} OUSD
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Fee {formatNumber(Number(r.fee_ousd ?? Number(r.amount) * 0.02), 2)} · Pay
                        out{" "}
                        <span className="font-semibold text-foreground">
                          {formatNumber(
                            Number(r.net_ousd ?? Number(r.amount) * 0.98),
                            2,
                          )}{" "}
                          OUSD
                        </span>
                      </p>
                      <p className="text-sm">
                        {r.display_name || "—"}{" "}
                        <span className="text-muted-foreground">
                          @{r.username || "unknown"}
                        </span>
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {r.destination_kind === "openpay" ? "OpenPay OP…" : "Pi"}
                        </span>
                      </p>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 break-all font-mono text-xs text-primary hover:underline"
                        onClick={() => void copyAddr(String(r.destination_address))}
                      >
                        {r.destination_address}
                        <Copy className="h-3 w-3 shrink-0" />
                      </button>
                      {r.note ? (
                        <p className="text-xs text-muted-foreground">Note: {r.note}</p>
                      ) : null}
                      <p className="text-[11px] text-muted-foreground">{timeAgo(r.created_at)}</p>
                    </div>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "outline"} className="capitalize">
                      {r.status === "completed" ? "successful" : r.status}
                    </Badge>
                  </div>

                  {r.status === "pending" ? (
                    <div className="space-y-3 border-t border-border pt-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Admin note</Label>
                          <Textarea
                            rows={2}
                            value={notes[r.id] ?? ""}
                            onChange={(e) =>
                              setNotes((s) => ({ ...s, [r.id]: e.target.value }))
                            }
                            placeholder="Optional"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Payout TX hash (approve)</Label>
                          <Input
                            value={hashes[r.id] ?? ""}
                            onChange={(e) =>
                              setHashes((s) => ({ ...s, [r.id]: e.target.value }))
                            }
                            placeholder="Optional proof"
                            className="font-mono text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="gap-1.5"
                          disabled={reviewM.isPending}
                          onClick={() =>
                            reviewM.mutate({
                              id: r.id,
                              action: "approve",
                              admin_note: notes[r.id]?.trim() || null,
                              payout_tx_hash: hashes[r.id]?.trim() || null,
                            })
                          }
                        >
                          <Check className="h-4 w-4" />
                          Approve (successful)
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          className="gap-1.5"
                          disabled={reviewM.isPending}
                          onClick={() =>
                            reviewM.mutate({
                              id: r.id,
                              action: "reject",
                              admin_note: notes[r.id]?.trim() || "Rejected",
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                          Reject &amp; refund
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-border pt-2 text-xs text-muted-foreground">
                      {r.admin_note ? <p>Admin: {r.admin_note}</p> : null}
                      {r.payout_tx_hash ? (
                        <p className="mt-1 font-mono">TX: {r.payout_tx_hash}</p>
                      ) : null}
                    </div>
                  )}
                </Card>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
