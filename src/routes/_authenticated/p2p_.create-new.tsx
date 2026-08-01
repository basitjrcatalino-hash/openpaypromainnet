import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { notifySuccess } from "@/lib/notify-success";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { P2pAssetIcon } from "@/components/p2p/P2pUi";
import { P2pPaymentMethodPicker } from "@/components/p2p/P2pPaymentMethodPicker";
import { P2pPayIcon } from "@/components/p2p/P2pPayIcon";
import { TxConfirmModal } from "@/components/wallet/TxConfirmModal";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  P2P_ASSETS,
  P2P_MAX_AMOUNT_OUSD,
  createAd,
  fetchMyMerchant,
  fetchMyPaymentAccounts,
  fetchPaymentMethods,
  fmtAmount,
  merchantCanList,
  p2pAmountExceedsLimit,
  p2pLimitError,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p_/create-new")({
  head: () => ({
    meta: [
      { title: "Create ad — OpenPay Pro P2P" },
      { name: "description", content: "Publish a P2P buy or sell advertisement." },
      { property: "og:title", content: "Create ad — OpenPay Pro P2P" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreateAdPage,
});

function CreateAdPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { code: fiat } = useCurrency();
  const [side, setSide] = useState<"sell" | "buy">("sell");
  const [asset, setAsset] = useState("OUSD");
  const [price, setPrice] = useState("1.00");
  const [total, setTotal] = useState("100");
  const [min, setMin] = useState("10");
  const [max, setMax] = useState("100");
  const [limitMin, setLimitMin] = useState("15");
  const [terms, setTerms] = useState("");
  const [methods, setMethods] = useState<string[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const methodsQ = useQuery({ queryKey: ["p2p-methods"], queryFn: fetchPaymentMethods });
  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const merchantQ = useQuery({
    queryKey: ["p2p-my-merchant", userQ.data],
    enabled: !!userQ.data,
    queryFn: fetchMyMerchant,
  });
  const canList = merchantCanList(merchantQ.data);
  const accountsQ = useQuery({
    queryKey: ["p2p-payment-accounts", userQ.data],
    enabled: !!userQ.data,
    queryFn: () => fetchMyPaymentAccounts(userQ.data as string),
  });

  const activeMethodCodes = useMemo(
    () => new Set((accountsQ.data ?? []).filter((a) => a.is_active).map((a) => a.method_code)),
    [accountsQ.data],
  );
  const missingReceive = useMemo(
    () => (side === "sell" ? methods.filter((c) => !activeMethodCodes.has(c)) : []),
    [side, methods, activeMethodCodes],
  );

  const methodLabels = useMemo(
    () =>
      methods.map((code) => {
        const m = (methodsQ.data ?? []).find((x) => x.code === code);
        return m?.name ?? code;
      }),
    [methods, methodsQ.data],
  );

  const priceN = Number(price) || 0;
  const totalN = Number(total) || 0;
  const minN = Number(min) || 0;
  const maxN = Number(max) || 0;
  const limitN = Number(limitMin) || 15;
  const fiatTotal = priceN * totalN;

  const create = useMutation({
    mutationFn: () =>
      createAd({
        side,
        asset,
        priceUsd: priceN,
        totalAmount: totalN,
        minOrder: minN,
        maxOrder: maxN,
        paymentMethods: methods,
        payTimeLimitMinutes: limitN,
        terms: terms.trim() || null,
      }),
    onSuccess: () => {
      setConfirmOpen(false);
      notifySuccess("Advertisement published", { sound: "success" });
      void qc.invalidateQueries({ queryKey: ["p2p-my-ads"] });
      void qc.invalidateQueries({ queryKey: ["p2p-ads"] });
      void navigate({ to: "/p2p/create" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalid = useMemo(
    () =>
      !(priceN > 0) ||
      !(totalN > 0) ||
      !(minN > 0) ||
      !(maxN >= minN) ||
      methods.length === 0 ||
      !agreed ||
      (side === "sell" && missingReceive.length > 0) ||
      p2pAmountExceedsLimit(asset, totalN, priceN) ||
      p2pAmountExceedsLimit(asset, maxN, priceN) ||
      p2pAmountExceedsLimit(asset, minN, priceN),
    [priceN, totalN, minN, maxN, methods, agreed, side, missingReceive, asset],
  );

  const openConfirm = () => {
    if (invalid) {
      toast.error(
        missingReceive.length
          ? "Add receive accounts for selected payment methods"
          : "Fill in all required ad details first",
      );
      return;
    }
    setConfirmOpen(true);
  };

  if (merchantQ.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canList) {
    return (
      <div className="px-4 pb-28 pt-4 md:px-6">
        <header className="mb-4 flex items-center gap-2">
          <Link
            to="/p2p/create"
            className="grid h-9 w-9 place-items-center rounded-full text-foreground press"
            aria-label="Back to ads"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold">Create ad</h1>
        </header>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-bold text-amber-500">Merchant approval required</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Complete KYC, fund ≥100 OUSD in P2P, apply as merchant, then wait for admin approval.
          </p>
          <Button
            asChild
            className="mt-3 h-9 rounded-xl bg-[#11C66D] text-xs font-bold text-white hover:bg-[#0FB461]"
          >
            <Link to="/p2p/merchant">Apply now</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <header
        className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border/40 bg-background/95 px-4 backdrop-blur-xl md:px-6"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <Link
          to="/p2p/create"
          className="grid h-9 w-9 place-items-center rounded-full text-foreground press"
          aria-label="Back to ads"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">Create ad</h1>
      </header>

      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-4 md:px-6">
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-500">
          Limit: up to {P2P_MAX_AMOUNT_OUSD.toLocaleString()} OUSD per ad / order
          {asset !== "OUSD" ? " (or $5,000 notional)" : ""}.
        </div>

        <div className="inline-flex rounded-full bg-muted/60 p-1">
          {(["sell", "buy"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={cn(
                "h-9 rounded-full px-5 text-sm font-bold capitalize",
                side === s
                  ? s === "sell"
                    ? "bg-rose-500 text-white"
                    : "bg-emerald-500 text-white"
                  : "text-muted-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {side === "sell" ? (
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Sell ads lock crypto from your P2P account. Transfer from Funding first if needed.{" "}
            <Link
              to="/transfer"
              search={{ from: "funding", to: "p2p" }}
              className="font-semibold text-primary"
            >
              Transfer to P2P ›
            </Link>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {P2P_ASSETS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAsset(a)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold",
                asset === a ? "border-foreground bg-secondary" : "border-border",
              )}
            >
              <P2pAssetIcon asset={a} className="h-4 w-4" />
              {a}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (USD)" value={price} onChange={setPrice} />
          <Field label={`Total (${asset})`} value={total} onChange={setTotal} />
          <Field label="Min order" value={min} onChange={setMin} />
          <Field label="Max order" value={max} onChange={setMax} />
          <Field label="Pay window (min)" value={limitMin} onChange={setLimitMin} />
        </div>

        <div className="space-y-1.5">
          <Label>Payment methods</Label>
          <P2pPaymentMethodPicker
            methods={methodsQ.data ?? []}
            mode="multi"
            values={methods}
            onToggle={(code) =>
              setMethods((prev) =>
                prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
              )
            }
            maxHeightClass="max-h-[40vh]"
          />
          {side === "sell" && methods.length > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              ✓ = receive account ready · ! = add account in Merchant wallet
            </p>
          ) : null}
          {side === "sell" && methods.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {methods.map((code) => {
                const m = (methodsQ.data ?? []).find((x) => x.code === code);
                const hasAccount = activeMethodCodes.has(code);
                return (
                  <span
                    key={code}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold",
                      hasAccount
                        ? "border-emerald-500/30 text-emerald-500"
                        : "border-amber-500/30 text-amber-500",
                    )}
                  >
                    <P2pPayIcon code={code} name={m?.name ?? code} size="xs" />
                    {m?.name ?? code} {hasAccount ? "✓" : "!"}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>

        {missingReceive.length > 0 ? (
          <p className="text-xs font-semibold text-amber-500">
            Missing receive accounts for: {missingReceive.join(", ")}.{" "}
            <Link to="/p2p/payments" className="underline underline-offset-2">
              Add in Merchant wallet
            </Link>
            .
          </p>
        ) : null}

        {(p2pAmountExceedsLimit(asset, totalN, priceN) ||
          p2pAmountExceedsLimit(asset, maxN, priceN)) && (
          <p className="text-xs font-semibold text-rose-500">{p2pLimitError(asset)}</p>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
            Merchant instructions
          </label>
          <Textarea
            value={terms}
            maxLength={1000}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Payment notes buyers will see (e.g. include order ref, preferred bank branch…)"
            className="min-h-24"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Shown to customers on the trade sheet and order page.
          </p>
        </div>

        <label className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#11C66D]"
          />
          <span>
            I agree to the{" "}
            <Link
              to="/p2p/agreement"
              className="font-semibold text-foreground underline-offset-2 hover:underline"
            >
              P2P User Agreement
            </Link>
            ,{" "}
            <Link
              to="/p2p/rules"
              className="font-semibold text-foreground underline-offset-2 hover:underline"
            >
              Trading Rules
            </Link>
            , and{" "}
            <Link
              to="/p2p/terms"
              className="font-semibold text-foreground underline-offset-2 hover:underline"
            >
              P2P Terms
            </Link>
            .
          </span>
        </label>

        <Button
          className="h-12 w-full rounded-full font-bold"
          disabled={invalid || create.isPending}
          onClick={openConfirm}
        >
          Review &amp; publish
        </Button>
      </div>

      <TxConfirmModal
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!create.isPending) setConfirmOpen(open);
        }}
        title="Confirm ad"
        description={
          side === "sell"
            ? "Review setup — sell ads reserve crypto from your P2P account when orders open."
            : "Review setup — your buy ad will appear on the marketplace after publish."
        }
        icon={<P2pAssetIcon asset={asset} className="h-12 w-12" />}
        amount={`${fmtAmount(totalN)} ${asset}`}
        subtitle={`${side === "sell" ? "Sell" : "Buy"} · ${formatCurrency(fiatTotal, fiat as never, { compact: false })}`}
        variant={side === "sell" ? "destructive" : "success"}
        confirmLabel="Publish ad"
        cancelLabel="Edit details"
        busy={create.isPending}
        disabled={create.isPending}
        onConfirm={() => create.mutate()}
        rows={[
          { label: "Type", value: side === "sell" ? "Sell" : "Buy" },
          { label: "Asset", value: asset },
          {
            label: "Price",
            value: formatCurrency(priceN, fiat as never, { compact: false }),
            mono: true,
          },
          {
            label: "Total amount",
            value: `${fmtAmount(totalN)} ${asset}`,
            mono: true,
          },
          {
            label: "Order range",
            value: `${fmtAmount(minN)} – ${fmtAmount(maxN)} ${asset}`,
            mono: true,
          },
          { label: "Pay window", value: `${limitN} min` },
          {
            label: "Payment methods",
            value: methodLabels.length ? methodLabels.join(", ") : "—",
          },
          ...(terms.trim()
            ? [{ label: "Instructions", value: terms.trim() }]
            : []),
          ...(side === "sell"
            ? [
                {
                  label: "P2P reserve",
                  value: "Locked per order from P2P balance when a trade opens",
                },
              ]
            : []),
        ]}
        notice={
          side === "sell" ? (
            <span>
              Make sure your P2P account holds enough {asset} and receive accounts are ready for
              each payment method.
            </span>
          ) : (
            <span>Buyers will see your price, limits, and payment methods on the marketplace.</span>
          )
        }
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        className="h-10 tabular-nums"
      />
    </div>
  );
}
