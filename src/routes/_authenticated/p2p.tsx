import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Clock3, Gift, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CurrencyPickerSheet } from "@/components/wallet/CurrencyPickerSheet";
import {
  BuySellToggle,
  FilterChip,
  FilterChipRow,
  MerchantStatLine,
  P2pEmptyState,
} from "@/components/p2p/P2pUi";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  P2P_ASSETS,
  P2P_MAX_AMOUNT_OUSD,
  expireOrders,
  fetchAds,
  fetchDisplayNames,
  fetchPaymentMethods,
  fetchTraderStats,
  fmtAmount,
  isTraderOnline,
  openOrder,
  p2pAmountExceedsLimit,
  p2pLimitError,
  type P2PAd,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p")({
  head: () => ({
    meta: [
      { title: "P2P Marketplace — OpenPay Pro" },
      {
        name: "description",
        content:
          "Buy and sell crypto peer-to-peer with escrow protection, local payment methods and OKX-style trading.",
      },
      { property: "og:title", content: "P2P Marketplace — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: P2PMarketplace,
});

function P2PMarketplace() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [asset, setAsset] = useState<string>("OUSD");
  const [amountFilter, setAmountFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [assetOpen, setAssetOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [fiatOpen, setFiatOpen] = useState(false);
  const [selected, setSelected] = useState<P2PAd | null>(null);
  const { code: fiat, setCode, meta } = useCurrency();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const adSide = side === "buy" ? "sell" : "buy";

  const methodsQ = useQuery({ queryKey: ["p2p-methods"], queryFn: fetchPaymentMethods });
  const adsQ = useQuery({
    queryKey: ["p2p-ads", adSide, asset],
    queryFn: () => fetchAds({ side: adSide, asset }),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    void expireOrders().catch(() => {});
  }, []);

  const traderIds = (adsQ.data ?? []).map((a) => a.user_id);
  const names = useQuery({
    queryKey: ["p2p-names", traderIds.join(",")],
    queryFn: () => fetchDisplayNames(traderIds),
    enabled: traderIds.length > 0,
  });
  const stats = useQuery({
    queryKey: ["p2p-stats", traderIds.join(",")],
    queryFn: () => fetchTraderStats(traderIds),
    enabled: traderIds.length > 0,
  });

  const methodLabel = useMemo(() => {
    const m: Record<string, string> = {};
    for (const pm of methodsQ.data ?? []) m[pm.code] = `${pm.icon ?? ""} ${pm.name}`.trim();
    return m;
  }, [methodsQ.data]);

  const filtered = useMemo(() => {
    let list = adsQ.data ?? [];
    const amt = Number(amountFilter);
    if (amt > 0) {
      list = list.filter(
        (ad) => amt >= Number(ad.min_order) && amt <= Math.min(Number(ad.max_order), Number(ad.available_amount)),
      );
    }
    if (methodFilter) {
      list = list.filter((ad) => ad.payment_methods.includes(methodFilter));
    }
    return list;
  }, [adsQ.data, amountFilter, methodFilter]);

  const buy = useMutation({
    mutationFn: (v: { adId: string; amount: number; method: string }) =>
      openOrder(v.adId, v.amount, v.method),
    onSuccess: (order) => {
      toast.success("Escrow locked — trade started");
      void qc.invalidateQueries({ queryKey: ["p2p-ads"] });
      setSelected(null);
      void navigate({ to: "/p2p/order/$id", params: { id: order.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-[70dvh]">
      <div className="flex items-center gap-3 border-b border-border/40 px-4 py-2.5 md:px-6">
        <Gift className="h-4 w-4 text-emerald-500" />
        <p className="flex-1 truncate text-xs text-muted-foreground">
          Escrow-protected P2P · zero platform trading fees
        </p>
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <BuySellToggle value={side} onChange={setSide} />
        <button
          type="button"
          onClick={() => setFiatOpen(true)}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-bold press"
        >
          {meta.code}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="border-b border-border/40 px-3 pb-3 md:px-5">
        <FilterChipRow>
          <FilterChip
            label={asset}
            active
            onClick={() => setAssetOpen(true)}
          />
          <FilterChip
            label={amountFilter ? `Amt ${amountFilter}` : "Amount"}
            active={!!amountFilter}
            onClick={() => {
              const next = window.prompt("Filter by crypto amount", amountFilter || "");
              if (next == null) return;
              setAmountFilter(next.replace(/[^0-9.]/g, ""));
            }}
          />
          <FilterChip
            label={
              methodFilter
                ? methodLabel[methodFilter] ?? methodFilter
                : "Payment methods"
            }
            active={!!methodFilter}
            onClick={() => setMethodOpen(true)}
          />
        </FilterChipRow>
      </div>

      {adsQ.isLoading ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !filtered.length ? (
        <P2pEmptyState
          title="No ads found"
          description={`No ${side} offers for ${asset} match your filters.`}
        />
      ) : (
        <div className="divide-y divide-border/40">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(7rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 border-b border-border/40 px-6 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span>Advertisers</span>
            <span>Price</span>
            <span>Available / Limit</span>
            <span>Payment</span>
            <span className="w-24 text-right">Trade</span>
          </div>
          {filtered.map((ad, idx) => {
            const st = stats.data?.[ad.user_id];
            const name = names.data?.[ad.user_id] ?? "Trader";
            const priceFiat = formatCurrency(Number(ad.price_usd), fiat, { compact: false });
            const minFiat = formatCurrency(Number(ad.min_order) * Number(ad.price_usd), fiat, {
              compact: false,
            });
            const maxFiat = formatCurrency(
              Math.min(Number(ad.max_order), Number(ad.available_amount)) * Number(ad.price_usd),
              fiat,
              { compact: false },
            );
            return (
              <article
                key={ad.id}
                className={cn(
                  "relative px-4 py-4 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(7rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:gap-4 md:px-6",
                  idx === 0 && "border-l-2 border-l-emerald-500/80 bg-emerald-500/3",
                )}
              >
                {idx === 0 ? (
                  <span className="absolute left-4 top-2 text-[10px] font-bold text-emerald-500 md:left-6">
                    Paid ad
                  </span>
                ) : null}

                {/* Merchant */}
                <div className={cn("min-w-0", idx === 0 && "mt-3 md:mt-0")}>
                  <div className="flex items-start justify-between gap-3 md:block">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-bold">{name}</p>
                        <span className="text-amber-400" title="Verified">
                          ◆
                        </span>
                      </div>
                      <MerchantStatLine
                        completed={st?.completed_count}
                        completionRate={st?.completion_rate}
                        online={isTraderOnline(st?.last_active_at)}
                      />
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground md:mt-1">
                      <Clock3 className="h-3 w-3" />
                      {ad.pay_time_limit_minutes} min
                    </span>
                  </div>
                </div>

                {/* Price */}
                <p className="mt-3 text-2xl font-extrabold tabular-nums tracking-tight md:mt-0 md:text-xl">
                  {priceFiat}
                </p>

                {/* Available / Limit */}
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground md:mt-0">
                  <p>
                    <span className="md:hidden">Available </span>
                    <span className="font-semibold text-foreground/80">
                      {fmtAmount(ad.available_amount)} {ad.asset}
                    </span>
                  </p>
                  <p>
                    <span className="md:hidden">Limit </span>
                    <span className="font-semibold text-foreground/80">
                      {minFiat} – {maxFiat}
                    </span>
                  </p>
                </div>

                {/* Payment + CTA — side-by-side on mobile; separate grid cells on md+ */}
                <div className="mt-3 flex items-end justify-between gap-3 md:mt-0 md:contents">
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 md:block md:space-y-1">
                    {ad.payment_methods.slice(0, 3).map((code) => (
                      <span
                        key={code}
                        className="truncate text-[11px] font-medium text-muted-foreground"
                      >
                        {methodLabel[code] ?? code}
                      </span>
                    ))}
                  </div>
                  <Button
                    onClick={() => setSelected(ad)}
                    className={cn(
                      "h-9 shrink-0 rounded-full px-5 text-sm font-bold md:w-24",
                      side === "buy"
                        ? "bg-emerald-500 text-white hover:bg-emerald-500/90"
                        : "bg-rose-500 text-white hover:bg-rose-500/90",
                    )}
                  >
                    {side === "buy" ? "Buy" : "Sell"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CurrencyPickerSheet
        open={fiatOpen}
        onOpenChange={setFiatOpen}
        value={fiat}
        onSelect={setCode}
      />

      <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select crypto</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {P2P_ASSETS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setAsset(a);
                  setAssetOpen(false);
                }}
                className={cn(
                  "h-11 rounded-xl border text-sm font-bold",
                  asset === a ? "border-foreground bg-secondary" : "border-border",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={methodOpen} onOpenChange={setMethodOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Payment methods</DialogTitle>
          </DialogHeader>
          <button
            type="button"
            className="mb-2 h-10 w-full rounded-xl border border-border text-sm font-semibold"
            onClick={() => {
              setMethodFilter(null);
              setMethodOpen(false);
            }}
          >
            All payment methods
          </button>
          <div className="flex flex-wrap gap-2">
            {(methodsQ.data ?? [])
              .filter((m) => m.is_active)
              .map((m) => (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => {
                    setMethodFilter(m.code);
                    setMethodOpen(false);
                  }}
                  className={cn(
                    "h-9 rounded-xl border px-3 text-xs font-semibold",
                    methodFilter === m.code
                      ? "border-foreground bg-secondary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {m.icon} {m.name}
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      <BuyDialog
        ad={selected}
        side={side}
        fiat={fiat}
        methodLabel={methodLabel}
        onClose={() => setSelected(null)}
        pending={buy.isPending}
        onConfirm={(amount, method) =>
          selected && buy.mutate({ adId: selected.id, amount, method })
        }
      />
    </div>
  );
}

function BuyDialog({
  ad,
  side,
  fiat,
  methodLabel,
  onClose,
  onConfirm,
  pending,
}: {
  ad: P2PAd | null;
  side: "buy" | "sell";
  fiat: string;
  methodLabel: Record<string, string>;
  onClose: () => void;
  onConfirm: (amount: number, method: string) => void;
  pending: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("");
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!ad) return;
    setAmount(String(ad.min_order));
    setMethod(ad.payment_methods[0] ?? "");
  }, [ad]);

  useEffect(() => {
    let alive = true;
    if (!ad || side !== "sell") {
      setBalance(null);
      return;
    }
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: w } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", data.user.id)
        .order("is_active", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive || !w) return;
      const key = `${ad.asset.toLowerCase()}_balance` as keyof typeof w;
      setBalance(Number(w[key] ?? 0));
    })();
    return () => {
      alive = false;
    };
  }, [ad, side]);

  const amt = Number(amount || 0);
  const totalUsd = ad ? amt * Number(ad.price_usd) : 0;
  const overLimit = ad
    ? p2pAmountExceedsLimit(ad.asset, amt, Number(ad.price_usd))
    : false;
  const invalid =
    !ad ||
    !method ||
    !(amt > 0) ||
    amt < Number(ad.min_order) ||
    amt > Math.min(Number(ad.max_order), Number(ad.available_amount)) ||
    overLimit ||
    (side === "sell" && balance != null && amt > balance);

  return (
    <Dialog open={!!ad} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md border-border/60 bg-background">
        <DialogHeader>
          <DialogTitle>
            {side === "buy" ? "Buy" : "Sell"} {ad?.asset}
          </DialogTitle>
          <DialogDescription>
            Price {ad ? formatCurrency(Number(ad.price_usd), fiat as never, { compact: false }) : "—"} ·
            limits {ad ? `${fmtAmount(ad.min_order)} – ${fmtAmount(ad.max_order)}` : ""}
            {" · "}max {P2P_MAX_AMOUNT_OUSD.toLocaleString()} OUSD
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Amount ({ad?.asset})</Label>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="h-12 text-lg font-bold tabular-nums"
            />
            {overLimit ? (
              <p className="text-[11px] font-semibold text-rose-500">
                {ad ? p2pLimitError(ad.asset) : "Amount too large"}
              </p>
            ) : null}
            {side === "sell" && balance != null ? (
              <p className="text-[11px] text-muted-foreground">
                Available {fmtAmount(balance)} {ad?.asset}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <div className="flex flex-wrap gap-2">
              {(ad?.payment_methods ?? []).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setMethod(code)}
                  className={cn(
                    "h-9 rounded-xl border px-3 text-xs font-semibold",
                    method === code
                      ? "border-foreground bg-secondary text-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {methodLabel[code] ?? code}
                </button>
              ))}
            </div>
          </div>

          {ad?.terms ? (
            <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              <span className="font-bold text-foreground">Terms:</span> {ad.terms}
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
            <span className="text-sm text-muted-foreground">
              {side === "buy" ? "You pay" : "You receive"}
            </span>
            <span className="text-lg font-extrabold tabular-nums">
              {formatCurrency(totalUsd, fiat as never, { compact: false })}
            </span>
          </div>

          <Button
            className={cn(
              "h-12 w-full rounded-full text-base font-bold",
              side === "buy"
                ? "bg-emerald-500 text-white hover:bg-emerald-500/90"
                : "bg-rose-500 text-white hover:bg-rose-500/90",
            )}
            disabled={invalid || pending}
            onClick={() => onConfirm(amt, method)}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start escrow trade"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
