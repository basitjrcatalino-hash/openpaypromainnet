import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ChevronDown, Loader2, RefreshCw, SlidersHorizontal, Info, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  P2pAssetIcon,
  P2pAssetPickerGrid,
  P2pEmptyState,
  PaymentMethodTags,
  TradeCta,
} from "@/components/p2p/P2pUi";
import { MerchantBadge } from "@/components/p2p/MerchantBadge";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  expireOrders,
  fetchAds,
  fetchDisplayNames,
  fetchMerchants,
  fetchPaymentMethods,
  fetchRatingStats,
  fetchTraderStats,
  fmtAmount,
  sortAdsByMerchantRank,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p")({
  head: () => ({
    meta: [
      { title: "P2P Marketplace — OpenPay Pro" },
      {
        name: "description",
        content:
          "Buy and sell crypto peer-to-peer with escrow protection — Bitget-style P2P trading on OpenPay Pro.",
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
  const [bannerOpen, setBannerOpen] = useState(true);
  const { code: fiat, setCode, meta } = useCurrency();
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
  const ratings = useQuery({
    queryKey: ["p2p-rating-stats", traderIds.join(",")],
    queryFn: () => fetchRatingStats(traderIds),
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
        (ad) =>
          amt >= Number(ad.min_order) &&
          amt <= Math.min(Number(ad.max_order), Number(ad.available_amount)),
      );
    }
    if (methodFilter) {
      list = list.filter((ad) => ad.payment_methods.includes(methodFilter));
    }
    return sortAdsByMerchantRank(list, merchants.data ?? {}, adSide);
  }, [adsQ.data, amountFilter, methodFilter, merchants.data, adSide]);

  function openTake(adId: string) {
    void navigate({
      to: "/p2p/take/$adId",
      params: { adId },
      search: { side },
    });
  }

  return (
    <div className="min-h-[70dvh]">
      {bannerOpen ? (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/8 px-3 py-2.5 md:mx-5">
          <Info className="h-4 w-4 shrink-0 text-sky-500" />
          <p className="flex-1 text-[12px] font-medium text-foreground/90">
            Get more event updates and security insights.
          </p>
          <span className="text-[10px] tabular-nums text-muted-foreground">1/3</span>
          <button
            type="button"
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground press"
            aria-label="Dismiss"
            onClick={() => setBannerOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="sticky top-11 z-20 border-b border-border/30 bg-background/95 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3 md:px-5">
          <BuySellToggle value={side} onChange={setSide} />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFiatOpen(true)}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[14px] font-bold press"
            >
              {meta.code}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground press"
              aria-label="Refresh"
              onClick={() => void adsQ.refetch()}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", adsQ.isFetching && "animate-spin")} />
            </button>
          </div>
        </div>

        <div className="px-3 pb-2.5 md:px-4">
          <FilterChipRow>
            <FilterChip
              label={asset}
              active
              onClick={() => setAssetOpen(true)}
              icon={<P2pAssetIcon asset={asset} className="h-4 w-4" />}
            />
            <FilterChip
              label={amountFilter ? `Limit ${amountFilter}` : "Limit"}
              active={!!amountFilter}
              onClick={() => {
                setAmountDraft(amountFilter);
                setAmountOpen(true);
              }}
            />
            <FilterChip
              label={methodFilter ? (methodLabel[methodFilter] ?? methodFilter) : "Method"}
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
            <button
              type="button"
              className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground press"
              aria-label="More filters"
              onClick={() => setAmountOpen(true)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
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
        <div className="divide-y divide-border/25">
          {filtered.map((ad) => {
            const st = stats.data?.[ad.user_id];
            const rt = ratings.data?.[ad.user_id];
            const name = names.data?.[ad.user_id] ?? "Trader";
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
            const verified =
              !!merch?.has_verified_badge || (!!merch && merch.tier !== "none");

            return (
              <article
                key={ad.id}
                className={cn("px-4 py-3.5 md:px-5", featured && "bg-[#11C66D]/4")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      <p className="truncate text-[14px] font-bold leading-tight">{name}</p>
                      {verified ? (
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#4DA3FF]" />
                      ) : null}
                      <MerchantBadge merchant={merch} />
                    </div>
                    <MerchantStatLine
                      compact
                      completed={st?.completed_count}
                      completionRate={st?.completion_rate ?? rt?.positive_rate}
                      responseMin={ad.pay_time_limit_minutes}
                    />
                  </div>
                  <p className="shrink-0 text-[22px] font-extrabold leading-none tabular-nums tracking-tight">
                    {priceFiat}
                  </p>
                </div>

                <div className="mt-2.5 space-y-0.5 text-[12px] text-muted-foreground">
                  <p>
                    Quantity{" "}
                    <span className="font-semibold text-foreground/90">
                      {fmtAmount(ad.available_amount)} {ad.asset}
                    </span>
                  </p>
                  <p>
                    Limit{" "}
                    <span className="font-semibold text-foreground/85">
                      {minFiat} – {maxFiat}
                    </span>
                  </p>
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <PaymentMethodTags codes={ad.payment_methods} labels={methodLabel} max={4} />
                  <TradeCta side={side} onClick={() => openTake(ad.id)} />
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
              className="h-10 flex-1 rounded-lg"
              onClick={() => {
                setAmountFilter("");
                setAmountOpen(false);
              }}
            >
              Clear
            </Button>
            <Button
              className="h-10 flex-1 rounded-lg bg-foreground text-background hover:bg-foreground/90"
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
          <div className="max-h-[60vh] overflow-y-auto pr-0.5">
            <P2pAssetPickerGrid
              value={asset}
              onSelect={(a) => {
                setAsset(a);
                setAssetOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
