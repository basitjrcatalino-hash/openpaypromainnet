import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
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
  MerchantAvatar,
  MerchantStatLine,
  P2pEmptyState,
  PaymentMethodTags,
  TradeCta,
} from "@/components/p2p/P2pUi";
import { MerchantBadge } from "@/components/p2p/MerchantBadge";
import { P2pPayIcon } from "@/components/p2p/P2pPayIcon";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  P2P_ASSETS,
  P2P_MAX_AMOUNT_OUSD,
  expireOrders,
  fetchAds,
  fetchDisplayNames,
  fetchMerchants,
  fetchPaymentMethods,
  fetchTraderStats,
  fmtAmount,
  isTraderOnline,
  openOrder,
  p2pAmountExceedsLimit,
  p2pLimitError,
  sortAdsByMerchantRank,
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
  const payParam = useRouterState({
    select: (s) => {
      const q = s.location.search as Record<string, unknown>;
      return typeof q.pay === "string" && q.pay.trim() ? q.pay.trim() : null;
    },
  });
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [asset, setAsset] = useState<string>("OUSD");
  const [amountFilter, setAmountFilter] = useState("");
  const [assetOpen, setAssetOpen] = useState(false);
  const [fiatOpen, setFiatOpen] = useState(false);
  const [amountOpen, setAmountOpen] = useState(false);
  const [amountDraft, setAmountDraft] = useState("");
  const [selected, setSelected] = useState<P2PAd | null>(null);
  const { code: fiat, setCode, meta } = useCurrency();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const methodFilter = payParam;
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
  const merchants = useQuery({
    queryKey: ["p2p-merchants", traderIds.join(",")],
    queryFn: () => fetchMerchants(traderIds),
    enabled: traderIds.length > 0,
  });

  const methodLabel = useMemo(() => {
    const m: Record<string, string> = {};
    for (const pm of methodsQ.data ?? []) m[pm.code] = pm.name;
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
    return sortAdsByMerchantRank(list, merchants.data ?? {}, adSide);
  }, [adsQ.data, amountFilter, methodFilter, merchants.data, adSide]);

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
      {/* Sticky OKX-style control strip */}
      <div className="sticky top-11 z-20 border-b border-border/40 bg-background/95 backdrop-blur-xl">
        <div className="flex items-center gap-2 px-4 py-1.5 text-[11px] text-muted-foreground md:px-5">
          <ShieldCheck className="h-3.5 w-3.5 text-[#11C66D]" />
          <p className="flex-1 truncate">0 trading fees · Escrow protected</p>
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-[4px] text-muted-foreground press"
            aria-label="Refresh"
            onClick={() => void adsQ.refetch()}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", adsQ.isFetching && "animate-spin")} />
          </button>
        </div>

        <div className="flex items-end justify-between gap-3 px-4 pb-2 pt-1 md:px-5">
          <BuySellToggle value={side} onChange={setSide} />
          <button
            type="button"
            onClick={() => setFiatOpen(true)}
            className="mb-0.5 inline-flex h-7 items-center gap-1 rounded-[4px] px-1.5 text-[13px] font-bold press"
          >
            {meta.code}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-3 pb-2.5 md:px-4">
          <FilterChipRow>
            <FilterChip label={asset} active onClick={() => setAssetOpen(true)} />
            <FilterChip
              label={amountFilter ? `Amt ${amountFilter}` : "Amount"}
              active={!!amountFilter}
              onClick={() => {
                setAmountDraft(amountFilter);
                setAmountOpen(true);
              }}
            />
            <FilterChip
              label={
                methodFilter ? methodLabel[methodFilter] ?? methodFilter : "All payments"
              }
              active={!!methodFilter}
              onClick={() =>
                void navigate({
                  to: "/p2p/select-payment",
                  search: {
                    return: "/p2p",
                    method: methodFilter ?? undefined,
                    all: "1",
                  },
                })
              }
            />
          </FilterChipRow>
        </div>
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
        <div className="divide-y divide-border/30">
          <div className="hidden grid-cols-[minmax(0,1.35fr)_minmax(6.5rem,0.65fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 border-b border-border/40 px-5 py-2 text-[11px] font-semibold text-muted-foreground md:grid lg:px-6">
            <span>Advertisers</span>
            <span>Price</span>
            <span>Available / Limit</span>
            <span>Payment</span>
            <span className="w-[4.75rem] text-right">Trade</span>
          </div>

          {filtered.map((ad) => {
            const st = stats.data?.[ad.user_id];
            const name = names.data?.[ad.user_id] ?? "Trader";
            const online = isTraderOnline(st?.last_active_at);
            const merch = merchants.data?.[ad.user_id];
            const featured = !!merch?.is_featured;
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
                  "relative px-4 py-3 md:grid md:grid-cols-[minmax(0,1.35fr)_minmax(6.5rem,0.65fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:gap-3 md:px-5 lg:px-6",
                  featured && "bg-[#11C66D]/[0.04]",
                )}
              >
                {featured ? (
                  <span className="mb-1.5 inline-flex rounded-[2px] bg-[#11C66D]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#11C66D] md:absolute md:left-5 md:top-2 lg:left-6">
                    Featured
                  </span>
                ) : null}

                {/* Advertiser */}
                <div className={cn("min-w-0", featured && "md:mt-3")}>
                  <div className="flex items-center gap-2">
                    <MerchantAvatar name={name} online={online} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-1">
                        <p className="truncate text-[13px] font-bold leading-tight">{name}</p>
                        <MerchantBadge merchant={merch} />
                      </div>
                      <MerchantStatLine
                        compact
                        completed={st?.completed_count}
                        completionRate={st?.completion_rate}
                        responseMin={ad.pay_time_limit_minutes}
                      />
                    </div>
                  </div>
                </div>

                {/* Price — dominant OKX signal */}
                <p className="mt-2.5 text-[22px] font-extrabold leading-none tabular-nums tracking-tight md:mt-0 md:text-lg">
                  {priceFiat}
                </p>

                {/* Qty / limits */}
                <div className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-muted-foreground md:mt-0 md:text-xs">
                  <p>
                    <span className="md:hidden">Available </span>
                    <span className="font-semibold text-foreground/85">
                      {fmtAmount(ad.available_amount)} {ad.asset}
                    </span>
                  </p>
                  <p>
                    <span className="md:hidden">Limit </span>
                    <span className="font-medium text-foreground/75">
                      {minFiat} – {maxFiat}
                    </span>
                  </p>
                </div>

                {/* Payments + CTA */}
                <div className="mt-2.5 flex items-end justify-between gap-3 md:mt-0 md:contents">
                  <div className="min-w-0 flex-1 md:block">
                    <PaymentMethodTags codes={ad.payment_methods} labels={methodLabel} />
                  </div>
                  <TradeCta side={side} onClick={() => setSelected(ad)} className="md:w-[4.75rem]" />
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

      <Dialog open={amountOpen} onOpenChange={setAmountOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Filter by amount</DialogTitle>
            <DialogDescription>Show ads that can fill this crypto amount.</DialogDescription>
          </DialogHeader>
          <Input
            inputMode="decimal"
            value={amountDraft}
            onChange={(e) => setAmountDraft(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={`Amount in ${asset}`}
            className="h-11"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-10 flex-1 rounded-[6px]"
              onClick={() => {
                setAmountFilter("");
                setAmountOpen(false);
              }}
            >
              Clear
            </Button>
            <Button
              className="h-10 flex-1 rounded-[6px] bg-foreground text-background hover:bg-foreground/90"
              onClick={() => {
                setAmountFilter(amountDraft);
                setAmountOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                  "h-11 rounded-[6px] border text-sm font-bold",
                  asset === a ? "border-foreground bg-secondary" : "border-border",
                )}
              >
                {a}
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
                    "inline-flex h-9 items-center gap-2 rounded-[6px] border px-3 text-xs font-semibold",
                    method === code
                      ? "border-foreground bg-secondary text-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  <P2pPayIcon code={code} name={methodLabel[code] ?? code} size="sm" />
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
              "h-12 w-full rounded-[8px] text-base font-bold",
              side === "buy"
                ? "bg-[#11C66D] text-white hover:bg-[#0FB461]"
                : "bg-[#F04438] text-white hover:bg-[#DE3A2F]",
            )}
            disabled={invalid || pending}
            onClick={() => onConfirm(amt, method)}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `${side === "buy" ? "Buy" : "Sell"} ${ad?.asset ?? ""}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
