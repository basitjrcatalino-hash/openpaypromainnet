/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowLeftRight,
  BadgeCheck,
  Copy,
  ExternalLink,
  Globe,
  MoreHorizontal,
  MessageCircle,
  Plus,
  QrCode,
  Send,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { OusdIcon } from "@/components/ousd-icon";
import { PhantomSparkline, type PhantomPeriod } from "@/components/opentoken/PriceChart";
import { cn } from "@/lib/utils";
import {
  fetchActiveWallet,
  formatNumber,
  formatPct,
  formatUSD,
  shortAddress,
} from "@/lib/wallet-utils";
import { formatTokenPrice, useCurrency } from "@/lib/currency";
import { OPENPAY_NETWORK_BADGE_URL, OUSD_LOGO_URL } from "@/lib/token-logos";
import { websiteHref } from "@/lib/opentoken/social";
import { buyOpenToken } from "@/lib/opentoken.functions";
import { buyMajorWithOusd } from "@/lib/buy-major.functions";
import { executeOpenDexSwap } from "@/lib/opendex.functions";
import {
  settleOpenPayCharge,
  settleOpenPayPayLinkTopup,
} from "@/lib/openpay-pro.functions";
import {
  AssetBuySheet,
  PENDING_CHARGE_KEY,
  runPendingAssetBuy,
} from "@/components/wallet/AssetBuySheet";
import {
  majorWatchKey,
  ousdWatchKey,
  tokenWatchKey,
  useWatchlist,
} from "@/lib/watchlist";
import {
  getMajorToken,
  isMajorTokenId,
  fetchMajorMarkets,
  majorMarketById,
} from "@/lib/major-tokens";
import {
  LEDGER_BALANCE_COLUMN,
  type LedgerAssetCode,
  walletMajorSelect,
} from "@/lib/ledger-majors";
import { MoonPayBuyOverlay } from "@/components/moonpay-buy-overlay";
import {
  PhantomAssetTradeBar,
  TokenMarketInsights,
} from "@/components/wallet/TokenMarketInsights";

export const Route = createFileRoute("/_authenticated/asset_/$tokenId")({
  head: ({ params }) => {
    const major = getMajorToken(params.tokenId);
    const title =
      params.tokenId === "ousd"
        ? "OUSD"
        : major
          ? major.symbol
          : "Token";
    return { meta: [{ title: `${title} — OpenPay Pro` }] };
  },
  validateSearch: (
    s: Record<string, unknown>,
  ): {
    openpay_charge?: string;
    openpay_ref?: string;
    openpay_tx?: string;
    openpay_return?: "1";
    openpay_cancel?: "1";
  } => ({
    openpay_charge: typeof s.openpay_charge === "string" ? s.openpay_charge : undefined,
    openpay_ref: typeof s.openpay_ref === "string" ? s.openpay_ref : undefined,
    openpay_tx: typeof s.openpay_tx === "string" ? s.openpay_tx : undefined,
    openpay_return: s.openpay_return ? "1" : undefined,
    openpay_cancel: s.openpay_cancel ? "1" : undefined,
  }),
  component: PhantomAssetDetail,
});

function PhantomAssetDetail() {
  const { tokenId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/asset_/$tokenId" });
  const qc = useQueryClient();
  const { code: currency } = useCurrency();
  const settleCharge = useServerFn(settleOpenPayCharge);
  const settlePayLink = useServerFn(settleOpenPayPayLinkTopup);
  const buyFn = useServerFn(buyOpenToken);
  const buyMajorFn = useServerFn(buyMajorWithOusd);
  const swapFn = useServerFn(executeOpenDexSwap);
  const isOusd = tokenId === "ousd" || tokenId === "__ousd__";
  const isMajor = isMajorTokenId(tokenId);
  const majorDef = isMajor ? getMajorToken(tokenId) : null;
  const isPiMajor = isMajor && majorDef?.id === "pi";
  /** OpenPay ledger asset for receive QR / send (majors except PI settle as OUSD). */
  const ledgerAsset: LedgerAssetCode = isOusd
    ? "OUSD"
    : isMajor && majorDef
      ? (majorDef.symbol as Exclude<LedgerAssetCode, "OUSD">)
      : "OUSD";

  const [period, setPeriod] = useState<PhantomPeriod>("1D");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [moonpayOpen, setMoonpayOpen] = useState(false);
  const watch = useWatchlist(user.id);
  const watchKey = isOusd
    ? ousdWatchKey()
    : isMajor
      ? majorWatchKey(tokenId)
      : tokenWatchKey(tokenId);
  const watched = watch.isWatched(watchKey);

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: () =>
      fetchActiveWallet<{
        id: string;
        address: string;
        ousd_balance: number;
        name: string | null;
      }>(
        supabase,
        user.id,
        walletMajorSelect("id, user_id, address, ousd_balance, name"),
      ),
  });

  const { data: token, isLoading: tokenLoading } = useQuery({
    queryKey: ["asset-token", tokenId],
    enabled: !isOusd && !isMajor,
    queryFn: async () => {
      const { data, error } = await supabase.from("tokens").select("*").eq("id", tokenId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: majorMarkets } = useQuery({
    queryKey: ["major-markets"],
    enabled: isMajor,
    staleTime: 60_000,
    queryFn: fetchMajorMarkets,
  });

  const { data: holding } = useQuery({
    queryKey: ["ot-holding", tokenId, wallet?.id],
    enabled: !isOusd && !isMajor && !!wallet?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("token_holdings")
        .select("balance")
        .eq("wallet_id", wallet!.id)
        .eq("token_id", tokenId)
        .maybeSingle();
      return Number(data?.balance ?? 0);
    },
  });

  const { data: ticks = [] } = useQuery({
    queryKey: ["ot-ticks", tokenId, period],
    enabled: !isOusd && !isMajor,
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_price_ticks")
        .select("created_at, price, market_cap")
        .eq("token_id", tokenId)
        .order("created_at", { ascending: false })
        .limit(period === "1H" ? 48 : period === "1D" ? 96 : 180);
      return data ?? [];
    },
  });

  const majorMarket = isMajor && majorDef ? majorMarketById(majorMarkets, majorDef.id) : null;

  const majorTicks = useMemo(() => {
    if (!majorMarket?.sparkline?.length) return [];
    const now = Date.now();
    const n = majorMarket.sparkline.length;
    const step = (7 * 24 * 60 * 60 * 1000) / Math.max(n - 1, 1);
    return majorMarket.sparkline.map((price, i) => ({
      created_at: new Date(now - (n - 1 - i) * step).toISOString(),
      price,
    }));
  }, [majorMarket]);

  const meta = useMemo(() => {
    if (isOusd) {
      return {
        name: "OpenUSD OUSD",
        symbol: "OUSD",
        logo: OUSD_LOGO_URL,
        price: 1,
        change: 0,
        verified: true,
        description:
          "OUSD is OpenPay’s dollar-pegged stablecoin. 1 OUSD ≈ $1 USD and powers OpenToken trading, OpenDEX swaps, and wallet transfers.",
        website: "https://openpy.space",
        network: "OpenPay",
        marketCap: null as number | null,
        totalSupply: null as number | null,
        circulatingSupply: null as number | null,
        ath: null as number | null,
        atl: null as number | null,
        athDate: null as string | null,
        atlDate: null as string | null,
        category: null as string | null,
        volume24h: null as number | null,
        createdAt: null as string | null,
        contract: wallet?.address ?? null,
        status: "stable",
        nativeMajor: false,
      };
    }
    if (isMajor && majorDef) {
      const m = majorMarket ?? majorMarketById(undefined, majorDef.id);
      return {
        name: majorDef.name,
        symbol: majorDef.symbol,
        logo: majorDef.logoUrl,
        price: m.price,
        change: m.change24h,
        verified: true,
        description: majorDef.about,
        website: majorDef.website,
        network: majorDef.network,
        marketCap: m.marketCap,
        totalSupply: m.totalSupply,
        circulatingSupply: m.circulatingSupply,
        ath: m.ath,
        atl: m.atl,
        athDate: m.athDate,
        atlDate: m.atlDate,
        category: majorDef.category,
        volume24h: m.volume24h,
        createdAt: majorDef.createdAt,
        contract: majorDef.mintAddress ?? wallet?.address ?? null,
        status: majorDef.native ? "native" : "stablecoin",
        nativeMajor: true,
      };
    }
    return {
      name: token?.name ?? "Token",
      symbol: token?.symbol ?? "—",
      logo: token?.logo_url ?? null,
      price: Number(token?.price_usd ?? 0),
      change: Number(token?.change_24h ?? 0),
      verified: !!token?.is_verified,
      description: token?.description || `${token?.name ?? "This token"} trades on OpenToken and OpenDEX.`,
      website: token?.website ?? null,
      network: "OpenPay",
      marketCap: Number(token?.market_cap ?? 0),
      totalSupply: Number(token?.total_supply ?? 0),
      circulatingSupply: null as number | null,
      ath: null as number | null,
      atl: null as number | null,
      athDate: null as string | null,
      atlDate: null as string | null,
      category: (token?.category as string | null) ?? null,
      volume24h: Number(token?.volume_24h ?? 0),
      createdAt: token?.created_at ?? null,
      contract: token?.contract_address ?? token?.id ?? null,
      status: token?.status ?? "curve",
      nativeMajor: false,
    };
  }, [
    isOusd,
    isMajor,
    majorDef,
    majorMarket,
    token,
    wallet?.address,
  ]);

  const balance = isOusd
    ? Number(wallet?.ousd_balance ?? 0)
    : isMajor && majorDef
      ? Number(
          (wallet as Record<string, unknown> | null | undefined)?.[
            LEDGER_BALANCE_COLUMN[majorDef.id]
          ] ?? 0,
        )
      : Number(holding ?? 0);
  /** Position unit on OpenPay ledger */
  const positionSymbol = meta.symbol;
  const positionPrice = meta.price;
  const valueUsd = balance * positionPrice;
  const changeAbs = valueUsd * (meta.change / 100);
  const up = meta.change >= 0;
  const returnPath = `/asset/${tokenId}`;

  function goReceive() {
    if (isOusd) {
      navigate({ to: "/wallet/receive", search: { network: "openpay", asset: "OUSD" } });
      return;
    }
    if (isMajor && majorDef) {
      // Receive picker keys networks by major id (solana→sol alias only for SOL).
      navigate({
        to: "/wallet/receive",
        search: {
          network: majorDef.id,
          asset: majorDef.symbol as LedgerAssetCode,
        },
      });
      return;
    }
    navigate({ to: "/wallet/receive", search: { network: "openpay", token: tokenId } });
  }

  useEffect(() => {
    if (search.openpay_cancel) {
      toast.error("OpenPay payment canceled");
      const u = new URL(window.location.href);
      u.searchParams.delete("openpay_cancel");
      window.history.replaceState({}, "", u.toString());
      return;
    }

    const settle = async () => {
      try {
        let chargeId = search.openpay_charge;
        if (!chargeId && search.openpay_return) {
          try {
            chargeId = sessionStorage.getItem(PENDING_CHARGE_KEY) ?? undefined;
          } catch {
            /* ignore */
          }
        }

        // Exclusive: checkout charge OR pay-link — never both.
        if (chargeId) {
          const r = await settleCharge({ data: { chargeId } });
          if (r.credited && wallet?.id) {
            const pending = await runPendingAssetBuy({
              buyFn,
              buyMajorFn,
              swapFn,
              walletId: wallet.id,
            });
            if (pending?.bought) {
              toast.success(
                `Bought ${formatNumber(pending.tokenAmount, 4)} $${pending.symbol}`,
              );
            } else if (!r.already) {
              toast.success("OpenPay payment complete · OUSD credited");
            }
            qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
            qc.invalidateQueries({ queryKey: ["ot-holding", tokenId] });
          }
          try {
            sessionStorage.removeItem(PENDING_CHARGE_KEY);
          } catch {
            /* ignore */
          }
        } else if (search.openpay_return && search.openpay_ref) {
          const r = await settlePayLink({
            data: { reference: search.openpay_ref, txId: search.openpay_tx, fromReturn: false },
          });
          if (r.credited && wallet?.id) {
            const pending = await runPendingAssetBuy({
              buyFn,
              buyMajorFn,
              swapFn,
              walletId: wallet.id,
              onGraduated: () => toast.success("Token graduated to OpenDEX!"),
            });
            if (pending?.bought) {
              toast.success(
                `Bought ${formatNumber(pending.tokenAmount, 4)} $${pending.symbol}`,
              );
            } else if (!r.already) {
              toast.success("OpenPay payment complete · OUSD credited");
            }
            qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
            qc.invalidateQueries({ queryKey: ["ot-holding", tokenId] });
          }
        }
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        const u = new URL(window.location.href);
        u.searchParams.delete("openpay_return");
        u.searchParams.delete("openpay_ref");
        u.searchParams.delete("openpay_tx");
        u.searchParams.delete("openpay_charge");
        window.history.replaceState({}, "", u.toString());
      }
    };

    if (
      search.openpay_return ||
      search.openpay_charge ||
      search.openpay_ref
    ) {
      void settle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.openpay_return, search.openpay_charge, search.openpay_ref, wallet?.id]);

  async function copy(text: string, label = "Copied") {
    try {
      await copyText(text);
      toast.success(label);
    } catch {
      toast.error("Copy failed");
    }
  }

  if (!isOusd && !isMajor && tokenLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">
        Loading token…
      </div>
    );
  }

  if (!isOusd && !isMajor && !token) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Token not found</p>
        <Button asChild className="rounded-full">
          <Link to="/dashboard">Back to wallet</Link>
        </Button>
      </div>
    );
  }

  const aboutPreview =
    meta.description.length > 140 && !aboutOpen
      ? `${meta.description.slice(0, 140)}…`
      : meta.description;

  const marketCapLabel =
    meta.marketCap != null && meta.marketCap > 0
      ? `${formatUSD(meta.marketCap, { compact: true })} market cap`
      : `${meta.symbol} · OpenPay Pro`;

  return (
    <div className="ot-phantom mx-auto max-w-lg animate-page-in safe-pb">
      {/* Header — Phantom: back · logo+name · favorite + verified */}
      <div className="ph-header sticky top-0 z-20 flex items-center gap-2 py-3 md:rounded-2xl">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => navigate({ to: "/dashboard" })}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full">
            {isOusd ? (
              <OusdIcon className="h-7 w-7" />
            ) : meta.logo ? (
              <img src={meta.logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-primary/20 text-[10px] font-bold text-primary">
                {meta.symbol.slice(0, 2)}
              </div>
            )}
          </div>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-[15px] font-semibold text-foreground">{meta.name}</h1>
            <div className="truncate text-xs tabular-nums text-muted-foreground">
              {formatTokenPrice(meta.price, currency, { maxLen: 12 })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Link
            to="/asset/$tokenId/chat"
            params={{ tokenId: isOusd ? "ousd" : tokenId }}
            className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary press hover:bg-primary/25"
            aria-label="Live Chat"
          >
            <MessageCircle className="h-4 w-4" />
          </Link>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground press"
            aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
            onClick={() => {
              void watch.toggleWatch(watchKey).then(
                (next) => toast.success(next ? "Added to watchlist" : "Removed from watchlist"),
                (e) => toast.error((e as Error).message || "Watchlist update failed"),
              );
            }}
          >
            <Star className={cn("h-4 w-4", watched && "fill-amber-400 text-amber-400")} />
          </button>
          {meta.verified && (
            <span className="grid h-7 w-7 place-items-center rounded-full bg-violet-500 text-white">
              <BadgeCheck className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>

      <div className="space-y-6 px-4 pt-2">
        {/* Price hero — Phantom left-aligned large price */}
        <div>
          <div className="text-[2.5rem] font-bold leading-none tracking-tight tabular-nums text-foreground">
            {formatTokenPrice(meta.price, currency, { maxLen: 14 })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span
              className={cn(
                "font-semibold tabular-nums",
                up ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400",
              )}
            >
              {up ? "+" : ""}
              {formatUSD(Math.abs(meta.price * (meta.change / 100)))} ({formatPct(meta.change)})
            </span>
          </div>
        </div>

        {/* Chart — Phantom-style green up / red down (all tokens) */}
        <PhantomSparkline
          period={period}
          onPeriodChange={setPeriod}
          ticks={isOusd ? null : isMajor ? majorTicks : ticks}
          price={meta.price}
          changePct={meta.change}
          tokenKey={isOusd ? "ousd" : tokenId}
          peg={isOusd}
          footnote={
            isOusd
              ? "Pegged at $1.00 · stablecoin"
              : isMajor
                ? `OpenPay Pro · ${ledgerAsset} · market data via CoinGecko`
                : undefined
          }
        />

        {/* Actions — Phantom-style with Buy */}
        <div className="grid grid-cols-5 gap-2">
          <ActionTile
            icon={Plus}
            label="Buy"
            primary
            onClick={() => {
              setBuyOpen(true);
            }}
          />
          <ActionTile
            icon={Send}
            label="Send"
            onClick={() => {
              if (isMajor) {
                navigate({
                  to: "/send",
                  search: { asset: ledgerAsset },
                });
                return;
              }
              navigate({
                to: "/send",
                search: isOusd ? { asset: "OUSD" } : { token: tokenId },
              });
            }}
          />
          <ActionTile
            icon={ArrowLeftRight}
            label="Swap"
            onClick={() => {
              if (isMajor) {
                navigate({
                  to: "/swap",
                  search: { asset: ledgerAsset },
                });
                return;
              }
              navigate({
                to: "/swap",
                search: isOusd ? { asset: "OUSD" } : { token: tokenId },
              });
            }}
          />
          <ActionTile icon={QrCode} label="Receive" onClick={goReceive} />
          <ActionTile icon={MoreHorizontal} label="More" onClick={() => setMoreOpen(true)} />
        </div>

        {/* AI insights + Related News / Lists — Phantom */}
        <TokenMarketInsights
          tokenKey={isOusd ? "ousd" : tokenId}
          name={meta.name}
          symbol={meta.symbol}
          network={meta.network}
          category={meta.category}
          priceUsd={meta.price}
          change24h={meta.change}
          marketCap={meta.marketCap}
          volume24h={meta.volume24h}
          description={meta.description}
          chatTokenId={isOusd ? "ousd" : tokenId}
        />

        {/* Position */}
        <section>
          <h2 className="mb-2 text-sm text-muted-foreground">Position</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-border bg-card px-4 py-3">
              <div className="text-xs text-muted-foreground">Value</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-foreground">
                {formatUSD(valueUsd)}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3">
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="mt-1 truncate text-xl font-bold tabular-nums text-foreground">
                {formatNumber(balance, balance < 1 ? 6 : 4)} {positionSymbol}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
            <span className="text-sm text-muted-foreground">24h Change</span>
            <span className={cn("text-sm font-semibold tabular-nums", up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {up ? "+" : ""}
              {formatUSD(Math.abs(changeAbs))}
            </span>
          </div>
        </section>

        {/* Token address — OpenPay Pro wallet for OUSD + majors */}
        <section>
          <h2 className="mb-2 text-sm text-muted-foreground">Address</h2>
          {meta.contract ? (
            <button
              type="button"
              onClick={() => copy(meta.contract!, "Address copied")}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition hover:bg-muted/50"
            >
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">
                  {isMajor && majorDef?.mintAddress
                    ? "Solana mint"
                    : isOusd || isMajor
                      ? "OpenPay Pro wallet"
                      : "Token / contract"}
                </div>
                <div className="mt-0.5 font-mono text-sm text-foreground">
                  {shortAddress(meta.contract, 8, 8)}
                </div>
              </div>
              <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ) : (
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              Create a wallet to get your OpenPay Pro address.
            </div>
          )}
        </section>

        {/* Info */}
        <section>
          <h2 className="mb-2 text-sm text-muted-foreground">Info</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <InfoRow label="Name" value={meta.name} />
            <InfoRow label="Symbol" value={meta.symbol} />
            <InfoRow label="Network" value={meta.network} />
            {meta.category && <InfoRow label="Category" value={meta.category} />}
            {meta.marketCap != null && meta.marketCap > 0 && (
              <InfoRow
                label="Market Cap"
                value={formatUSD(meta.marketCap)}
              />
            )}
            {meta.circulatingSupply != null && meta.circulatingSupply > 0 && (
              <InfoRow label="Circulating Supply" value={formatNumber(meta.circulatingSupply, 0, { compact: true })} />
            )}
            {meta.totalSupply != null && meta.totalSupply > 0 && (
              <InfoRow label="Total Supply" value={formatNumber(meta.totalSupply, 0, { compact: true })} />
            )}
            {meta.ath != null && meta.ath > 0 && (
              <InfoRow label="All-Time High" value={formatUSD(meta.ath)} />
            )}
            {meta.atl != null && meta.atl > 0 && (
              <InfoRow label="All-Time Low" value={formatUSD(meta.atl)} />
            )}
            {meta.createdAt && (
              <InfoRow
                label="Created"
                value={new Date(meta.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              />
            )}
            {isOusd && <InfoRow label="Peg" value="$1.00 USD" last />}
            {isMajor && <InfoRow label="Type" value={`Native · ${meta.network}`} last />}
            {!isOusd && !isMajor && (
              <InfoRow label="Status" value={String(meta.status)} last />
            )}
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="mb-2 text-sm text-muted-foreground">About</h2>
          <p className="text-sm leading-relaxed text-foreground/90">{aboutPreview}</p>
          {(meta.description.length > 140 || (meta.website && websiteHref(meta.website))) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
              {meta.description.length > 140 && (
                <button
                  type="button"
                  className="text-sm font-medium text-primary"
                  onClick={() => setAboutOpen((v) => !v)}
                >
                  {aboutOpen ? "Show Less" : "Show More"}
                </button>
              )}
              {meta.website && websiteHref(meta.website) && (
                <a
                  href={websiteHref(meta.website)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
                >
                  <Globe className="h-4 w-4" /> Website
                </a>
              )}
            </div>
          )}
        </section>

        {!isOusd && (
          <section>
            <h2 className="mb-2 text-sm text-muted-foreground">24h Performance</h2>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Volume</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {formatUSD(meta.volume24h ?? Number(token?.volume_24h ?? 0))}
                  </span>
                  <span className={cn("text-sm font-medium", up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                    {formatPct(meta.change)}
                  </span>
                </div>
              </div>
              {!isMajor && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <span className="text-sm text-muted-foreground">Holders</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {formatNumber(token?.holder_count ?? 0, 0)}
                  </span>
                </div>
              )}
              {isMajor && meta.athDate && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <span className="text-sm text-muted-foreground">ATH date</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {new Date(meta.athDate).toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        <p className="pb-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          {isMajor
            ? isPiMajor
              ? "Pricing via CoinGecko. PI balance and transfers use your OpenPay Pro wallet on this account."
              : `Pricing via CoinGecko. ${meta.symbol} balance, buy, send, and receive use your OpenPay Pro wallet (custodial ledger at market price).`
            : "Past performance is not an indicator of future performance. OpenPay Pro wallet balances reflect your OUSD and OpenToken holdings on this account."}
        </p>
      </div>

      {/* More menu */}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent hideClose className="max-w-sm rounded-3xl border-border bg-card p-0">
          <DialogTitle className="sr-only">More</DialogTitle>
          <div className="mx-4 mb-3 mt-4 overflow-hidden rounded-2xl bg-muted/40">
            {isOusd ? (
              <MoreRow
                logoUrl={OUSD_LOGO_URL}
                label="Earn with OUSD"
                onClick={() => {
                  setMoreOpen(false);
                  navigate({ to: "/ousd" });
                }}
              />
            ) : isMajor && majorDef ? (
              <MoreRow
                logoUrl={majorDef.logoUrl}
                label={`${majorDef.name} website`}
                onClick={() => {
                  setMoreOpen(false);
                  window.open(majorDef.website, "_blank", "noopener,noreferrer");
                }}
              />
            ) : (
              <MoreRow
                logoUrl={OPENPAY_NETWORK_BADGE_URL}
                label="Trade on OpenToken"
                onClick={() => {
                  setMoreOpen(false);
                  navigate({ to: "/opentoken/$tokenId", params: { tokenId } });
                }}
              />
            )}
            {isMajor && majorDef?.moonpayCode && (
              <MoreRow
                logoUrl={majorDef.logoUrl}
                label={`Buy ${majorDef.symbol} on MoonPay`}
                onClick={() => {
                  setMoreOpen(false);
                  setMoonpayOpen(true);
                }}
              />
            )}
            <MoreRow
              icon={ArrowLeftRight}
              label="OpenDEX Swap"
              onClick={() => {
                setMoreOpen(false);
                if (isMajor) {
                  navigate({ to: "/swap", search: { asset: ledgerAsset } });
                } else {
                  navigate({
                    to: "/swap",
                    search: isOusd ? { asset: "OUSD" } : { token: tokenId },
                  });
                }
              }}
            />
            {meta.contract && (
              <MoreRow
                icon={ExternalLink}
                label={
                  isMajor && majorDef?.mintAddress
                    ? "Copy Solana mint"
                    : "Copy OpenPay Pro address"
                }
                onClick={() => {
                  void copy(
                    meta.contract!,
                    isMajor && majorDef?.mintAddress ? "Mint copied" : "Address copied",
                  );
                  setMoreOpen(false);
                }}
              />
            )}
          </div>
          <div className="px-4 pb-4">
            <Button className="w-full rounded-full" variant="secondary" onClick={() => setMoreOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AssetBuySheet
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        userId={user.id}
        walletId={wallet?.id}
        ousdBalance={Number(wallet?.ousd_balance ?? 0)}
        token={{
          id: isOusd ? "ousd" : isMajor && majorDef ? majorDef.id : tokenId,
          symbol: meta.symbol,
          name: meta.name,
          price: meta.price,
          logoUrl: meta.logo,
          isOusd,
          majorId: isMajor && majorDef ? majorDef.id : undefined,
          status: isOusd || isMajor ? "stable" : meta.status,
        }}
        returnPath={returnPath}
        onNavigateSwap={() => {
          if (isMajor) {
            navigate({ to: "/swap", search: { asset: ledgerAsset } });
          } else {
            navigate({
              to: "/swap",
              search: isOusd ? { asset: "OUSD" } : { token: tokenId },
            });
          }
        }}
      />

      {isMajor && majorDef?.moonpayCode && (
        <MoonPayBuyOverlay
          visible={moonpayOpen}
          amount={50}
          externalCustomerId={user.id}
          externalTransactionId={`major-${majorDef.id}-${Date.now()}`}
          defaultCurrencyCode={majorDef.moonpayCode}
          onClose={() => setMoonpayOpen(false)}
          onTransactionCompleted={async () => {
            toast.success(`${meta.symbol} purchase submitted via MoonPay`);
            setMoonpayOpen(false);
          }}
        />
      )}

      {/* Phantom market-cap + lavender Trade CTA */}
      <PhantomAssetTradeBar
        marketCapLabel={marketCapLabel}
        onTrade={() => {
          setBuyOpen(true);
        }}
      />
    </div>
  );
}

function ActionTile({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span
        className={cn(
          "grid h-12 w-full place-items-center rounded-2xl border transition press",
          primary
            ? "border-primary/40 bg-primary text-primary-foreground"
            : "border-border/80 bg-muted/80 text-primary hover:bg-accent",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[11px] font-medium text-foreground">{label}</span>
    </button>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3 text-sm",
        !last && "border-b border-border",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function MoreRow({
  icon: Icon,
  logoUrl,
  label,
  onClick,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  logoUrl?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-border/40 px-4 py-3.5 text-left last:border-0 hover:bg-muted/50"
    >
      <span
        className={cn(
          "grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-background text-foreground",
        )}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : Icon ? (
          <Icon className="h-4 w-4" />
        ) : null}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
