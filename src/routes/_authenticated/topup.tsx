import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Sparkles, Wallet as WalletIcon, Link2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/wallet-utils";
import { topUpWithPi } from "@/lib/pi-network";
import {
  createOpenPayTopupCharge,
  settleOpenPayCharge,
  settleOpenPayPayLinkTopup,
  getOpenPayLinkStatus,
} from "@/lib/openpay-pro.functions";

export const Route = createFileRoute("/_authenticated/topup")({
  head: () => ({ meta: [{ title: "Top Up — OpenPay Pro Wallet" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    openpay_charge: typeof s.openpay_charge === "string" ? s.openpay_charge : undefined,
    openpay_ref: typeof s.openpay_ref === "string" ? s.openpay_ref : undefined,
    openpay_tx: typeof s.openpay_tx === "string" ? s.openpay_tx : undefined,
    openpay_return: s.openpay_return ? "1" : undefined,
    openpay_cancel: s.openpay_cancel ? "1" : undefined,
  }),
  component: TopUpPage,
});

type Method = "openpay_balance" | "pi";
const methods: { id: Method; label: string; icon: any; desc: string }[] = [
  {
    id: "openpay_balance",
    label: "OpenPay Balance",
    icon: WalletIcon,
    desc: "Pay from your connected OpenPay account · real debit",
  },
  { id: "pi", label: "Pi Network (π)", icon: Sparkles, desc: "Pay with Pi · 1 π = 1 OUSD credited instantly" },
];

const presets = [25, 50, 100, 250, 500, 1000];
const schema = z.object({
  amount: z.coerce.number().positive().min(1, "Minimum $1").max(50000),
});

const PENDING_CHARGE_KEY = "openpay_pending_charge";
const PENDING_PAYLINK_KEY = "openpay_pending_paylink";

function TopUpPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/topup" });
  const [amount, setAmount] = useState("100");
  const [method, setMethod] = useState<Method>("openpay_balance");
  const [busy, setBusy] = useState(false);
  const [pendingPayLink, setPendingPayLink] = useState<{
    reference: string;
    amount: number;
    partner_username?: string;
  } | null>(null);

  const createCharge = useServerFn(createOpenPayTopupCharge);
  const settleCharge = useServerFn(settleOpenPayCharge);
  const settlePayLink = useServerFn(settleOpenPayPayLinkTopup);
  const getLink = useServerFn(getOpenPayLinkStatus);

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () =>
      (await supabase.from("wallets").select("*").eq("user_id", user.id).limit(1).maybeSingle()).data,
  });

  const { data: openpayLink } = useQuery({
    queryKey: ["openpay-link", user.id],
    queryFn: () => getLink(),
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_PAYLINK_KEY);
      if (raw) setPendingPayLink(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Settle OpenPay hosted-checkout / pay-link returns
  useEffect(() => {
    if (search.openpay_cancel) {
      toast.error("OpenPay payment canceled — order not completed");
      try {
        sessionStorage.removeItem(PENDING_CHARGE_KEY);
        sessionStorage.removeItem(PENDING_PAYLINK_KEY);
      } catch {
        /* ignore */
      }
      setPendingPayLink(null);
      const u = new URL(window.location.href);
      u.searchParams.delete("openpay_cancel");
      u.searchParams.delete("openpay_ref");
      window.history.replaceState({}, "", u.toString());
      return;
    }

    // Pay-link return: auto-confirm credit
    if (search.openpay_return && (search.openpay_ref || pendingPayLink?.reference)) {
      const reference = search.openpay_ref || pendingPayLink?.reference;
      (async () => {
        try {
          const r = await settlePayLink({
            data: {
              reference,
              txId: search.openpay_tx,
              fromReturn: true,
            },
          });
          if (r.credited) {
            toast.success("OpenPay payment complete · OUSD credited");
            setPendingPayLink(null);
            try {
              sessionStorage.removeItem(PENDING_PAYLINK_KEY);
            } catch {
              /* ignore */
            }
            qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
            qc.invalidateQueries({ queryKey: ["txs", wallet?.id] });
            qc.invalidateQueries({ queryKey: ["ledger-entries"] });
            qc.invalidateQueries({ queryKey: ["ledger-overview"] });
          } else {
            toast.message(r.message || "Confirming payment…");
            // Keep pending card visible for manual confirm
            if (reference && !pendingPayLink) {
              setPendingPayLink({ reference, amount: Number(amount) || 0 });
            }
          }
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          const u = new URL(window.location.href);
          u.searchParams.delete("openpay_return");
          u.searchParams.delete("openpay_ref");
          u.searchParams.delete("openpay_tx");
          window.history.replaceState({}, "", u.toString());
        }
      })();
      return;
    }

    let chargeId = search.openpay_charge;
    if (!chargeId && search.openpay_return) {
      try {
        chargeId = sessionStorage.getItem(PENDING_CHARGE_KEY) ?? undefined;
      } catch {
        /* ignore */
      }
    }
    if (!chargeId) return;

    (async () => {
      try {
        const r = await settleCharge({ data: { chargeId } });
        if (r.credited) toast.success("OpenPay payment complete · OUSD credited");
        else toast.message(`OpenPay charge status: ${r.status}`);
        qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
        qc.invalidateQueries({ queryKey: ["txs", wallet?.id] });
        qc.invalidateQueries({ queryKey: ["ledger-entries"] });
        qc.invalidateQueries({ queryKey: ["ledger-overview"] });
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        try {
          sessionStorage.removeItem(PENDING_CHARGE_KEY);
        } catch {
          /* ignore */
        }
        const u = new URL(window.location.href);
        u.searchParams.delete("openpay_charge");
        u.searchParams.delete("openpay_return");
        u.searchParams.delete("openpay_cancel");
        window.history.replaceState({}, "", u.toString());
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.openpay_charge, search.openpay_return, search.openpay_cancel, search.openpay_ref]);

  async function confirmPayLink() {
    if (!pendingPayLink?.reference) {
      toast.error("No pending OpenPay payment");
      return;
    }
    setBusy(true);
    try {
      const r = await settlePayLink({
        data: {
          reference: pendingPayLink.reference,
          fromReturn: false,
        },
      });
      if (r.credited) {
        toast.success(`Topped up ${formatUSD(pendingPayLink.amount)} from OpenPay`);
        setPendingPayLink(null);
        try {
          sessionStorage.removeItem(PENDING_PAYLINK_KEY);
        } catch {
          /* ignore */
        }
        qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
        qc.invalidateQueries({ queryKey: ["txs", wallet?.id] });
        qc.invalidateQueries({ queryKey: ["ledger-entries"] });
        qc.invalidateQueries({ queryKey: ["ledger-overview"] });
      } else {
        toast.message(r.message || "Payment not found yet");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ amount });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid");
      return;
    }

    setBusy(true);
    try {
      if (method === "openpay_balance") {
        if (!openpayLink?.linked) {
          toast.error("Connect OpenPay in Settings first");
          return;
        }
        const res = await createCharge({
          data: { amount: parsed.data.amount, origin: window.location.origin },
        });
        if (res.mode === "checkout") {
          const charge = res.charge;
          if (!charge?.checkout_url || !charge?.id) {
            throw new Error("OpenPay did not return a checkout URL");
          }
          try {
            sessionStorage.setItem(PENDING_CHARGE_KEY, charge.id);
          } catch {
            /* ignore */
          }
          window.location.href = charge.checkout_url;
          return;
        }
        // Pay-link fallback: user pays @partner from their OpenPay balance
        const pending = {
          reference: res.reference,
          amount: res.amount,
          partner_username: res.partner_username,
        };
        setPendingPayLink(pending);
        try {
          sessionStorage.setItem(PENDING_PAYLINK_KEY, JSON.stringify(pending));
        } catch {
          /* ignore */
        }
        window.location.href = res.pay_url;
        return;
      }
      // pi
      const { paymentId } = await topUpWithPi(parsed.data.amount);
      toast.success(
        `Pi payment complete · ${parsed.data.amount} OUSD credited (${paymentId.slice(0, 8)}…)`,
      );
      qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
      qc.invalidateQueries({ queryKey: ["txs", wallet?.id] });
      qc.invalidateQueries({ queryKey: ["ledger-entries"] });
      qc.invalidateQueries({ queryKey: ["ledger-overview"] });
      setAmount("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const linked = !!openpayLink?.linked;
  const cta =
    method === "openpay_balance"
      ? linked
        ? `Pay ${amount ? formatUSD(Number(amount)) : ""} with OpenPay`
        : "Connect OpenPay to continue"
      : `Top up ${amount ? formatUSD(Number(amount)) : ""}`;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Top Up</h1>
        <p className="text-sm text-muted-foreground">Add OUSD to your wallet instantly</p>
      </div>

      <Card className="border-0 bg-gradient-primary p-5 text-white shadow-glow">
        <div className="text-xs uppercase tracking-widest opacity-80">Current OUSD balance</div>
        <div className="text-3xl font-bold tabular-nums">{formatUSD(Number(wallet?.ousd_balance ?? 0))}</div>
      </Card>

      {pendingPayLink && (
        <Card className="rounded-3xl border-primary/40 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-semibold">Waiting for OpenPay payment</p>
              <p className="text-xs text-muted-foreground">
                Pay {formatUSD(pendingPayLink.amount)}
                {pendingPayLink.partner_username
                  ? ` to @${pendingPayLink.partner_username}`
                  : ""}{" "}
                from your OpenPay account, then confirm here.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={busy}
                  onClick={confirmPayLink}
                >
                  {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Confirm payment
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setPendingPayLink(null);
                    try {
                      sessionStorage.removeItem(PENDING_PAYLINK_KEY);
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Amount (USD)
            </Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="1"
              step="any"
              required
              className="h-14 text-2xl font-bold tabular-nums"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    amount === String(p)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted",
                  )}
                >
                  ${p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Payment method
            </Label>
            <div className="space-y-2">
              {methods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                    method === m.id
                      ? "border-primary bg-primary/5 shadow-glow"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
                    <m.icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {method === "openpay_balance" && (
            <div className="rounded-2xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              {linked ? (
                <>
                  Paying from connected OpenPay
                  {openpayLink?.username
                    ? ` @${openpayLink.username}`
                    : openpayLink?.account_number
                      ? ` · ${openpayLink.account_number}`
                      : ""}
                  . You’ll confirm on OpenPay — your OpenPay balance is debited, then this wallet is
                  credited.
                </>
              ) : (
                <span className="flex flex-wrap items-center gap-2">
                  Connect your OpenPay account first so Top Up can debit your balance.
                  <Link to="/settings" className="inline-flex items-center gap-1 font-medium text-primary">
                    <Link2 className="h-3.5 w-3.5" />
                    Settings → Connect
                  </Link>
                </span>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={busy || (method === "openpay_balance" && !linked)}
            className="h-12 w-full rounded-2xl bg-gradient-primary text-base font-semibold text-primary-foreground shadow-glow"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            {cta}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            New accounts start with a zero balance. Top up to begin.
          </p>
        </form>
      </Card>
    </div>
  );
}
