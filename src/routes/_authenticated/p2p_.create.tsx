import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { notifySuccess } from "@/lib/notify-success";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { P2pEmptyState } from "@/components/p2p/P2pUi";
import { P2pPaymentMethodPicker } from "@/components/p2p/P2pPaymentMethodPicker";
import { P2pPayChip, P2pPayIcon } from "@/components/p2p/P2pPayIcon";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  P2P_ASSETS,
  P2P_MAX_AMOUNT_OUSD,
  createAd,
  fetchMyAds,
  fetchMyMerchant,
  fetchMyPaymentAccounts,
  fetchPaymentMethods,
  fmtAmount,
  merchantCanList,
  p2pAmountExceedsLimit,
  p2pLimitError,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p_/create")({
  head: () => ({
    meta: [
      { title: "P2P Ads — OpenPay Pro" },
      { name: "description", content: "Manage your P2P buy and sell advertisements." },
      { property: "og:title", content: "P2P Ads — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdsHubPage,
});

function AdsHubPage() {
  const [creating, setCreating] = useState(false);
  const { code: fiat } = useCurrency();
  const qc = useQueryClient();

  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const myAdsQ = useQuery({
    queryKey: ["p2p-my-ads", userQ.data],
    queryFn: () => fetchMyAds(userQ.data as string),
    enabled: !!userQ.data,
  });
  const methodsQ = useQuery({ queryKey: ["p2p-methods"], queryFn: fetchPaymentMethods });
  const merchantQ = useQuery({
    queryKey: ["p2p-my-merchant", userQ.data],
    enabled: !!userQ.data,
    queryFn: fetchMyMerchant,
  });
  const canList = merchantCanList(merchantQ.data);

  const toggleStatus = useMutation({
    mutationFn: async (v: { id: string; status: "active" | "paused" }) => {
      const { error } = await supabase.from("p2p_ads").update({ status: v.status }).eq("id", v.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["p2p-my-ads"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <header
        className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-border/40 bg-background/95 px-4 backdrop-blur-xl md:px-6"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <h1 className="text-lg font-bold">Ads</h1>
        <button
          type="button"
          onClick={() => {
            if (!canList) {
              toast.error("Merchant approval required before listing ads");
              return;
            }
            setCreating(true);
          }}
          className="grid h-9 w-9 place-items-center rounded-full text-foreground press"
          aria-label="Create ad"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      {!canList ? (
        <div className="mx-4 mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 md:mx-6">
          <p className="text-sm font-bold text-amber-500">Merchant approval required</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Apply as a Verified Merchant and wait for admin approval — same flow as OKX / Binance P2P.
          </p>
          <Button asChild className="mt-3 h-9 rounded-[8px] bg-[#11C66D] text-xs font-bold text-white hover:bg-[#0FB461]">
            <Link to="/p2p/merchant">Apply now</Link>
          </Button>
        </div>
      ) : null}

      <div className="border-b border-border/40 px-4 py-2.5 text-xs text-muted-foreground md:px-6">
        Sell ads need a funded merchant wallet + receive accounts.{" "}
        <Link to="/p2p/wallet" className="font-semibold text-primary">
          Set up merchant wallet ›
        </Link>
      </div>

      {myAdsQ.isLoading ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !myAdsQ.data?.length ? (
        <P2pEmptyState
          title="No ads found"
          description={
            canList
              ? "Create an ad to buy or sell crypto."
              : "Get merchant approval first, then publish ads."
          }
          action={
            canList ? (
              <Button
                className="mt-2 h-10 rounded-full bg-secondary px-6 font-bold text-foreground"
                onClick={() => setCreating(true)}
              >
                Create ad
              </Button>
            ) : (
              <Button asChild className="mt-2 h-10 rounded-full bg-[#11C66D] px-6 font-bold text-white">
                <Link to="/p2p/merchant">Apply as merchant</Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="divide-y divide-border/40">
          {myAdsQ.data.map((ad) => (
            <div key={ad.id} className="px-4 py-4 md:px-6">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "text-sm font-bold capitalize",
                    ad.side === "sell" ? "text-rose-500" : "text-emerald-500",
                  )}
                >
                  {ad.side} {ad.asset}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                    ad.status === "active"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {ad.status}
                </span>
              </div>
              <p className="mt-2 text-xl font-extrabold tabular-nums">
                {formatCurrency(Number(ad.price_usd), fiat as never, { compact: false })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Available {fmtAmount(ad.available_amount)} / {fmtAmount(ad.total_amount)} {ad.asset}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ad.payment_methods.length ? (
                  ad.payment_methods.map((code) => {
                    const m = (methodsQ.data ?? []).find((x) => x.code === code);
                    return (
                      <P2pPayChip
                        key={code}
                        code={code}
                        label={m?.name ?? code}
                      />
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground">No methods</p>
                )}
              </div>
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full"
                  disabled={toggleStatus.isPending || ad.status === "closed"}
                  onClick={() =>
                    toggleStatus.mutate({
                      id: ad.id,
                      status: ad.status === "active" ? "paused" : "active",
                    })
                  }
                >
                  {ad.status === "active" ? "Pause" : "Activate"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateAdDialog open={creating && canList} onOpenChange={setCreating} />
    </div>
  );
}

function CreateAdDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
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

  const methodsQ = useQuery({ queryKey: ["p2p-methods"], queryFn: fetchPaymentMethods });
  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const accountsQ = useQuery({
    queryKey: ["p2p-payment-accounts", userQ.data],
    enabled: !!userQ.data && open,
    queryFn: () => fetchMyPaymentAccounts(userQ.data as string),
  });

  const activeMethodCodes = useMemo(
    () =>
      new Set(
        (accountsQ.data ?? []).filter((a) => a.is_active).map((a) => a.method_code),
      ),
    [accountsQ.data],
  );
  const missingReceive = useMemo(
    () => (side === "sell" ? methods.filter((c) => !activeMethodCodes.has(c)) : []),
    [side, methods, activeMethodCodes],
  );

  const create = useMutation({
    mutationFn: () =>
      createAd({
        side,
        asset,
        priceUsd: Number(price),
        totalAmount: Number(total),
        minOrder: Number(min),
        maxOrder: Number(max),
        paymentMethods: methods,
        payTimeLimitMinutes: Number(limitMin),
        terms: terms.trim() || null,
      }),
    onSuccess: () => {
      notifySuccess("Advertisement published", { sound: "success" });
      void qc.invalidateQueries({ queryKey: ["p2p-my-ads"] });
      void qc.invalidateQueries({ queryKey: ["p2p-ads"] });
      onOpenChange(false);
      void navigate({ to: "/p2p/create" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalid = useMemo(
    () =>
      !(Number(price) > 0) ||
      !(Number(total) > 0) ||
      !(Number(min) > 0) ||
      !(Number(max) >= Number(min)) ||
      methods.length === 0 ||
      !agreed ||
      (side === "sell" && missingReceive.length > 0) ||
      p2pAmountExceedsLimit(asset, Number(total), Number(price)) ||
      p2pAmountExceedsLimit(asset, Number(max), Number(price)) ||
      p2pAmountExceedsLimit(asset, Number(min), Number(price)),
    [price, total, min, max, methods, agreed, side, missingReceive, asset],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create ad</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
              Sell ads lock crypto from your merchant wallet and show your receive accounts to buyers.{" "}
              <Link to="/p2p/wallet" className="font-semibold text-primary" onClick={() => onOpenChange(false)}>
                Manage merchant wallet ›
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
                  "h-8 rounded-lg border px-3 text-xs font-bold",
                  asset === a ? "border-foreground bg-secondary" : "border-border",
                )}
              >
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
              maxHeightClass="max-h-56"
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
              Missing receive accounts for: {missingReceive.join(", ")}. Add them in Merchant wallet.
            </p>
          ) : null}

          {(p2pAmountExceedsLimit(asset, Number(total), Number(price)) ||
            p2pAmountExceedsLimit(asset, Number(max), Number(price))) && (
            <p className="text-xs font-semibold text-rose-500">{p2pLimitError(asset)}</p>
          )}

          <Textarea
            value={terms}
            maxLength={1000}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Terms (optional)"
            className="min-h-20"
          />

          <label className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#11C66D]"
            />
            <span>
              I agree to the{" "}
              <Link to="/p2p/agreement" className="font-semibold text-foreground underline-offset-2 hover:underline">
                P2P User Agreement
              </Link>
              ,{" "}
              <Link to="/p2p/rules" className="font-semibold text-foreground underline-offset-2 hover:underline">
                Trading Rules
              </Link>
              , and{" "}
              <Link to="/p2p/terms" className="font-semibold text-foreground underline-offset-2 hover:underline">
                P2P Terms
              </Link>
              .
            </span>
          </label>

          <Button
            className="h-11 w-full rounded-full font-bold"
            disabled={invalid || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish ad"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
