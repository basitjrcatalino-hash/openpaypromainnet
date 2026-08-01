/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { notifySuccess } from "@/lib/notify-success";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/wallet/PageHeader";
import { QrScannerButton } from "@/components/qr-scanner";
import { TxConfirmModal } from "@/components/wallet/TxConfirmModal";
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

type Step = "destination" | "amount";

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

  const [step, setStep] = useState<Step>("destination");
  const [amount, setAmount] = useState("");
  const [destKind, setDestKind] = useState<WithdrawalDestKind>("pi");
  const [dest, setDest] = useState("");
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
  const amountValid = Number.isFinite(amtNum) && amtNum >= min;
  const insufficient = amountValid && amtNum > bal + 1e-12;
  const destValid = isValidDestinationAddress(dest, destKind);
  const canSubmit = amountValid && !insufficient && destValid;

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
      notifySuccess("Withdrawal submitted — OUSD locked pending admin payout", { sound: "send" });
      setAmount("");
      setNote("");
      setConfirmOpen(false);
      setStep("destination");
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
      notifySuccess("Withdrawal cancelled — OUSD refunded", { sound: "receive" });
      void qc.invalidateQueries({ queryKey: ["withdraw-ctx"] });
      void qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => (histQ.data ?? []) as any[], [histQ.data]);

  const titles: Record<Step, string> = {
    destination: "Withdraw to",
    amount: "Enter amount",
  };

  return (
    <div className="ot-phantom ph-page mx-auto min-h-[70vh] max-w-lg pb-24">
      <PageHeader
        title={titles[step]}
        backTo={step === "destination" ? "/wallet" : undefined}
        onBack={step === "amount" ? () => setStep("destination") : undefined}
      />

      {step === "destination" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            <OusdIcon className="h-10 w-10 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">OUSD</p>
              <p className="text-[13px] text-muted-foreground">
                Available {formatNumber(bal, 2)} · Min {min}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-muted/40 p-1">
            {WITHDRAWAL_DEST_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => {
                  setDestKind(k.id);
                  setDest("");
                }}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-xs font-semibold transition press",
                  destKind === k.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-border bg-card p-4">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {destKind === "openpay" ? "OpenPay address" : "Pi mainnet wallet"}
            </label>
            <div className="flex gap-2">
              <Input
                value={dest}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setDest(v);
                  const detected = detectDestinationKind(v);
                  if (detected) setDestKind(detected);
                }}
                placeholder={destMeta.placeholder}
                className="h-12 rounded-2xl font-mono text-sm"
                autoCapitalize="characters"
                autoFocus
              />
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 shrink-0 rounded-2xl"
                    aria-label="Scan QR"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                }
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {destKind === "openpay"
                ? "OpenPay accounts start with OP (example: OPxxxxxxxx)."
                : "Use your Pi Network mainnet wallet address (usually starts with G)."}{" "}
              Funds lock to @{ctxQ.data?.treasury_username ?? "openpay"} (
              {shortAddress(ctxQ.data?.treasury_address ?? WITHDRAWAL_TREASURY_ADDRESS, 6, 4)}) until
              admin pays out.
            </p>
          </div>

          <Button
            type="button"
            className="h-12 w-full rounded-full text-base font-semibold"
            disabled={!destValid}
            onClick={() => setStep("amount")}
          >
            Continue
          </Button>
        </div>
      )}

      {step === "amount" && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setStep("destination")}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left press hover:bg-muted/40"
          >
            <OusdIcon className="h-10 w-10 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">OUSD</p>
              <p className="truncate font-mono text-[12px] text-muted-foreground">
                → {destKind === "openpay" ? "OpenPay" : "Pi"} ·{" "}
                {dest.length > 18 ? shortAddress(dest, 6, 4) : dest}
              </p>
            </div>
            <span className="text-xs font-semibold text-primary">Change</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="rounded-3xl border border-border bg-card px-4 py-8 text-center">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="0"
              autoFocus
              className="w-full bg-transparent text-center text-5xl font-bold tabular-nums text-foreground outline-none placeholder:text-muted-foreground/40"
            />
            <div className="mt-2 text-sm text-muted-foreground">OUSD</div>
            {amount.length > 0 && !amountValid && (
              <div className="mt-2 text-sm text-destructive">Minimum {min} OUSD</div>
            )}
            {insufficient && (
              <div className="mt-2 text-sm text-destructive">Insufficient balance</div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Available{" "}
              <span className="font-semibold text-foreground">
                {formatNumber(bal, 2)} OUSD
              </span>
            </span>
            <button
              type="button"
              className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary disabled:opacity-40"
              disabled={bal < min}
              onClick={() => setAmount(String(Math.floor(bal * 100) / 100))}
            >
              Max
            </button>
          </div>

          {amountValid && !insufficient ? (
            <div className="space-y-1.5 rounded-2xl bg-muted/40 px-4 py-3 text-sm">
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
            </div>
          ) : null}

          <div>
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-2xl px-1 py-2 text-left text-sm font-semibold text-muted-foreground press hover:text-foreground"
            >
              Details (optional)
              <ChevronDown
                className={cn("h-4 w-4 transition", detailsOpen && "rotate-180")}
              />
            </button>
            {detailsOpen ? (
              <div className="mt-2 space-y-3 rounded-3xl border border-border bg-card p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="wd-name"
                      className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      Name
                    </label>
                    <Input
                      id="wd-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="h-11 rounded-2xl"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="wd-user"
                      className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      Username
                    </label>
                    <Input
                      id="wd-user"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="@username"
                      className="h-11 rounded-2xl"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="wd-note"
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Note
                  </label>
                  <Textarea
                    id="wd-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Reference for you or admin"
                    rows={2}
                    className="rounded-2xl"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            className="h-12 w-full rounded-full text-base font-semibold"
            disabled={!canSubmit || ctxQ.isLoading}
            onClick={() => setConfirmOpen(true)}
          >
            Continue
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Full amount is deducted now ({feePercent}% fee + net payout). Status stays{" "}
            <strong>pending</strong> until admin approves or rejects.{" "}
            <Link to="/activity" className="underline underline-offset-2">
              Activity
            </Link>
          </p>
        </div>
      )}

      <TxConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm withdraw"
        description="OUSD locks until admin pays out"
        icon={<OusdIcon className="h-14 w-14" />}
        amount={`${formatNumber(amtNum, 2)} OUSD`}
        subtitle={`You receive ${formatNumber(feeSplit.net, 2)} after ${feePercent}% fee`}
        rows={[
          { label: "Asset", value: "OUSD" },
          {
            label: "To",
            value: dest.length > 22 ? shortAddress(dest, 8, 6) : dest,
            mono: true,
          },
          {
            label: "Via",
            value: destKind === "openpay" ? "OpenPay (OP…)" : "Pi mainnet",
          },
          { label: "Fee", value: `${formatNumber(feeSplit.fee, 2)} OUSD` },
          ...(note.trim() ? [{ label: "Note", value: note.trim() }] : []),
        ]}
        notice={
          <p>
            Funds lock to @{ctxQ.data?.treasury_username ?? "openpay"} until payout. You can cancel
            while status is pending.
          </p>
        }
        confirmLabel={`Lock & withdraw ${formatNumber(amtNum, 2)} OUSD`}
        busy={createM.isPending}
        onConfirm={() => createM.mutate()}
      />

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Withdrawal history
        </h2>
        {histQ.isLoading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No withdrawals yet.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-3xl bg-card">
            {rows.map((r, i) => (
              <li
                key={r.id}
                className={cn("px-4 py-3", i > 0 && "border-t border-border/50")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold tabular-nums">
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
