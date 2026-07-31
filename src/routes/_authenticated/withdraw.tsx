/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpFromLine,
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/wallet/PageHeader";
import { QrScannerButton } from "@/components/qr-scanner";
import { OusdIcon } from "@/components/ousd-icon";
import { cn } from "@/lib/utils";
import { formatNumber, shortAddress, timeAgo } from "@/lib/wallet-utils";
import {
  cancelMyWithdrawal,
  createOusdWithdrawal,
  getWithdrawContext,
  listMyWithdrawals,
} from "@/lib/withdraw.functions";
import {
  WITHDRAWAL_MIN_OUSD,
  WITHDRAWAL_TREASURY_ADDRESS,
  WITHDRAWAL_DEST_KINDS,
  WITHDRAWAL_FEE_BPS,
  calcWithdrawalFee,
  extractAddressFromScan,
  isValidDestinationAddress,
  detectDestinationKind,
  type WithdrawalDestKind,
} from "@/lib/withdraw-ousd";

export const Route = createFileRoute("/_authenticated/withdraw")({
  head: () => ({ meta: [{ title: "Withdraw OUSD — OpenPay Pro" }] }),
  component: WithdrawPage,
});

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600",
  completed: "bg-emerald-500/15 text-emerald-600",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

function WithdrawPage() {
  const qc = useQueryClient();
  const getCtx = useServerFn(getWithdrawContext);
  const listW = useServerFn(listMyWithdrawals);
  const createW = useServerFn(createOusdWithdrawal);
  const cancelW = useServerFn(cancelMyWithdrawal);

  const ctxQ = useQuery({ queryKey: ["withdraw-ctx"], queryFn: () => getCtx() });
  const histQ = useQuery({ queryKey: ["my-withdrawals"], queryFn: () => listW() });

  const bal = ctxQ.data?.wallet?.ousd_balance ?? 0;
  const min = ctxQ.data?.min_ousd ?? WITHDRAWAL_MIN_OUSD;
  const feeBps = ctxQ.data?.fee_bps ?? WITHDRAWAL_FEE_BPS;
  const feePercent = ctxQ.data?.fee_percent ?? feeBps / 100;

  const [amount, setAmount] = useState("");
  const [destKind, setDestKind] = useState<WithdrawalDestKind>("pi");
  const [dest, setDest] = useState("");
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const destMeta = WITHDRAWAL_DEST_KINDS.find((k) => k.id === destKind) ?? WITHDRAWAL_DEST_KINDS[0];

  useEffect(() => {
    if (!ctxQ.data || hydrated) return;
    setHydrated(true);
    setName(ctxQ.data.profile.display_name ?? "");
    setUsername(ctxQ.data.profile.username ?? "");
    if (ctxQ.data.profile.pi_wallet_address) {
      const pi = ctxQ.data.profile.pi_wallet_address;
      setDest(pi);
      const detected = detectDestinationKind(pi);
      if (detected) setDestKind(detected);
      else setDestKind("pi");
    }
  }, [ctxQ.data, hydrated]);

  const amtNum = Number(amount);
  const feeSplit = calcWithdrawalFee(
    Number.isFinite(amtNum) && amtNum > 0 ? amtNum : 0,
    feeBps,
  );
  const canSubmit =
    Number.isFinite(amtNum) &&
    amtNum >= min &&
    amtNum <= bal + 1e-12 &&
    isValidDestinationAddress(dest, destKind);

  const createM = useMutation({
    mutationFn: () =>
      createW({
        data: {
          amount: amtNum,
          destination_kind: destKind,
          destination_address: dest.trim(),
          note: note.trim() || null,
          display_name: name.trim() || null,
          username: username.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Withdrawal submitted — OUSD locked pending admin payout");
      setAmount("");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["withdraw-ctx"] });
      void qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelM = useMutation({
    mutationFn: (id: string) => cancelW({ data: { id } }),
    onSuccess: () => {
      toast.success("Withdrawal cancelled — OUSD refunded");
      void qc.invalidateQueries({ queryKey: ["withdraw-ctx"] });
      void qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => (histQ.data ?? []) as any[], [histQ.data]);

  return (
    <div className="mx-auto max-w-lg pb-24">
      <PageHeader title="Withdraw OUSD" backTo="/wallet" />
      <p className="mb-4 text-sm text-muted-foreground">
        Cash out to Pi or OpenPay (OP…). Minimum {min} OUSD.
      </p>

      <Card className="mb-6 space-y-4 border-border p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <OusdIcon className="h-8 w-8" />
            <div>
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="font-semibold tabular-nums">{formatNumber(bal, 2)} OUSD</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={bal < min}
            onClick={() => setAmount(String(Math.floor(bal * 100) / 100))}
          >
            Max
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wd-amount">Amount (OUSD)</Label>
          <Input
            id="wd-amount"
            inputMode="decimal"
            placeholder={`Min ${min}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wd-name">Name</Label>
            <Input
              id="wd-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wd-user">Username</Label>
            <Input
              id="wd-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Withdraw to</Label>
          <div className="grid grid-cols-2 gap-2">
            {WITHDRAWAL_DEST_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => {
                  setDestKind(k.id);
                  setDest("");
                }}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                  destKind === k.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60",
                )}
              >
                {k.label}
                <span className="mt-0.5 block text-[11px] font-normal opacity-80">{k.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="wd-dest">
              {destKind === "openpay" ? "OpenPay address (OP…)" : "Pi mainnet wallet"}
            </Label>
            <QrScannerButton
              hint={
                destKind === "openpay"
                  ? "Scan OpenPay OP… address QR"
                  : "Scan Pi wallet QR"
              }
              onResult={(text) => {
                const addr = extractAddressFromScan(text);
                if (!addr) {
                  toast.error("Could not read address from QR");
                  return;
                }
                const detected = detectDestinationKind(addr);
                if (detected && detected !== destKind) {
                  setDestKind(detected);
                }
                setDest(addr);
                toast.success("Address scanned");
              }}
              trigger={
                <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
                  <Camera className="h-3.5 w-3.5" />
                  Scan
                </Button>
              }
            />
          </div>
          <Input
            id="wd-dest"
            value={dest}
            onChange={(e) => {
              const v = e.target.value.trim();
              setDest(v);
              const detected = detectDestinationKind(v);
              if (detected) setDestKind(detected);
            }}
            placeholder={destMeta.placeholder}
            className="font-mono text-sm"
            autoCapitalize="characters"
          />
          <p className="text-xs text-muted-foreground">
            {destKind === "openpay"
              ? "OpenPay accounts start with OP (example: OPxxxxxxxx)."
              : "Use your Pi Network mainnet wallet address (usually starts with G)."}{" "}
            Funds lock to @{ctxQ.data?.treasury_username ?? "openpay"} (
            {shortAddress(ctxQ.data?.treasury_address ?? WITHDRAWAL_TREASURY_ADDRESS, 6, 4)}) until
            admin pays out.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wd-note">Note (optional)</Label>
          <Textarea
            id="wd-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reference for you or admin"
            rows={2}
          />
        </div>

        {amtNum >= min ? (
          <div className="space-y-1.5 rounded-2xl bg-muted/40 px-3 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Amount</span>
              <span className="tabular-nums font-medium">{formatNumber(amtNum, 2)} OUSD</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Fee ({feePercent}%)</span>
              <span className="tabular-nums font-medium">
                −{formatNumber(feeSplit.fee, 2)} OUSD
              </span>
            </div>
            <div className="flex justify-between gap-3 border-t border-border/60 pt-1.5">
              <span className="font-semibold">You receive</span>
              <span className="tabular-nums font-semibold">
                {formatNumber(feeSplit.net, 2)} OUSD
              </span>
            </div>
            <p className="pt-1 text-[11px] text-muted-foreground">
              Fee goes to @{ctxQ.data?.treasury_username ?? "openpay"} (
              {shortAddress(ctxQ.data?.fee_address ?? WITHDRAWAL_TREASURY_ADDRESS, 6, 4)}).
            </p>
          </div>
        ) : null}

        <Button
          type="button"
          className="w-full rounded-full"
          disabled={!canSubmit || createM.isPending || ctxQ.isLoading}
          onClick={() => createM.mutate()}
        >
          {createM.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowUpFromLine className="mr-2 h-4 w-4" />
          )}
          Lock &amp; withdraw {amtNum >= min ? formatNumber(amtNum, 2) : ""} OUSD
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Full amount is deducted now ({feePercent}% fee + net payout). Status stays{" "}
          <strong>pending</strong> until admin approves or rejects.{" "}
          <Link to="/activity" className="underline underline-offset-2">
            Activity
          </Link>
        </p>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Withdrawal history</h2>
        {histQ.isLoading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No withdrawals yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-border bg-card px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold tabular-nums">
                      {formatNumber(Number(r.amount), 2)} OUSD
                    </p>
                    {(r.fee_ousd != null || r.net_ousd != null) && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Fee {formatNumber(Number(r.fee_ousd ?? 0), 2)} · Net{" "}
                        {formatNumber(Number(r.net_ousd ?? r.amount), 2)}
                      </p>
                    )}
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      → {String(r.destination_address)}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                      {r.destination_kind === "openpay" ? "OpenPay (OP…)" : "Pi"}
                    </p>
                    {r.note ? (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.note}</p>
                    ) : null}
                    {r.admin_note && r.status !== "pending" ? (
                      <p className="mt-1 text-xs text-muted-foreground">Admin: {r.admin_note}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(r.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
                        STATUS_STYLE[r.status] ?? STATUS_STYLE.pending,
                      )}
                    >
                      {r.status === "pending" ? (
                        <Clock className="h-3 w-3" />
                      ) : r.status === "completed" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {r.status === "completed" ? "successful" : r.status}
                    </span>
                    {r.status === "pending" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive"
                        disabled={cancelM.isPending}
                        onClick={() => cancelM.mutate(r.id)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
