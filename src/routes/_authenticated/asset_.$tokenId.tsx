/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowLeftRight,
  BadgeCheck,
  Copy,
  ExternalLink,
  Globe,
  MoreHorizontal,
  QrCode,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OusdIcon } from "@/components/ousd-icon";
import { PriceChart } from "@/components/opentoken";
import { cn } from "@/lib/utils";
import {
  fetchActiveWallet,
  formatNumber,
  formatOUSD,
  formatPct,
  formatUSD,
  shortAddress,
} from "@/lib/wallet-utils";
import { OUSD_LOGO_URL } from "@/lib/token-logos";

export const Route = createFileRoute("/_authenticated/asset_/$tokenId")({
  head: ({ params }) => ({
    meta: [{ title: `${params.tokenId === "ousd" ? "OUSD" : "Token"} — OpenPay Pro` }],
  }),
  component: PhantomAssetDetail,
});

const PERIODS = ["1H", "1D", "1W", "1M", "YTD", "ALL"] as const;

function PhantomAssetDetail() {
  const { tokenId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const isOusd = tokenId === "ousd" || tokenId === "__ousd__";

  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("1D");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: () =>
      fetchActiveWallet<{ id: string; address: string; ousd_balance: number; name: string | null }>(
        supabase,
        user.id,
        "id, address, ousd_balance, name",
      ),
  });

  const { data: token, isLoading: tokenLoading } = useQuery({
    queryKey: ["asset-token", tokenId],
    enabled: !isOusd,
    queryFn: async () => {
      const { data, error } = await supabase.from("tokens").select("*").eq("id", tokenId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: holding } = useQuery({
    queryKey: ["ot-holding", tokenId, wallet?.id],
    enabled: !isOusd && !!wallet?.id,
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
    enabled: !isOusd,
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_price_ticks")
        .select("created_at, price, market_cap")
        .eq("token_id", tokenId)
        .order("created_at", { ascending: false })
        .limit(period === "1H" ? 24 : period === "1D" ? 96 : 180);
      return data ?? [];
    },
  });

  const meta = useMemo(() => {
    if (isOusd) {
      return {
        name: "OpenPay OUSD",
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
        createdAt: null as string | null,
        contract: wallet?.address ?? null,
        status: "stable",
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
      createdAt: token?.created_at ?? null,
      contract: token?.contract_address ?? token?.id ?? null,
      status: token?.status ?? "curve",
    };
  }, [isOusd, token, wallet?.address]);

  const balance = isOusd ? Number(wallet?.ousd_balance ?? 0) : Number(holding ?? 0);
  const valueUsd = balance * meta.price;
  const changeAbs = valueUsd * (meta.change / 100);
  const up = meta.change >= 0;

  async function copy(text: string, label = "Copied") {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error("Copy failed");
    }
  }

  if (!isOusd && tokenLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">
        Loading token…
      </div>
    );
  }

  if (!isOusd && !token) {
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

  return (
    <div className="ot-phantom mx-auto min-h-screen max-w-lg animate-page-in pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-2 bg-background/95 px-3 py-3 backdrop-blur-xl">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => navigate({ to: "/dashboard" })}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
          <h1 className="truncate text-lg font-bold text-foreground">{meta.name}</h1>
          {meta.verified && (
            <span className="grid h-5 w-5 place-items-center rounded-full bg-violet-500 text-white">
              <BadgeCheck className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <div className="w-9" />
      </div>

      <div className="space-y-6 px-4 pt-2">
        {/* Price hero */}
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 overflow-hidden rounded-full">
            {isOusd ? (
              <OusdIcon className="h-16 w-16" />
            ) : meta.logo ? (
              <img src={meta.logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-primary text-lg font-bold text-primary-foreground">
                {meta.symbol.slice(0, 2)}
              </div>
            )}
          </div>
          <div className="text-4xl font-bold tabular-nums text-foreground">
            {isOusd ? formatUSD(meta.price) : formatOUSD(meta.price, { price: true, suffix: false })}
            {!isOusd && <span className="ml-1 text-lg font-medium text-muted-foreground">OUSD</span>}
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 text-sm">
            <span className={cn("font-medium tabular-nums", up ? "text-emerald-400" : "text-red-400")}>
              {up ? "+" : ""}
              {formatUSD(Math.abs(meta.price * (meta.change / 100)))}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
              )}
            >
              {formatPct(meta.change)}
            </span>
          </div>
        </div>

        {/* Chart */}
        <div className="overflow-hidden rounded-2xl">
          {isOusd ? (
            <div className="grid h-48 place-items-center rounded-2xl bg-zinc-900/60 text-sm text-muted-foreground">
              Pegged at $1.00 · stablecoin
            </div>
          ) : (
            <PriceChart ticks={ticks} mode="price" />
          )}
          <div className="mt-3 flex flex-wrap justify-center gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  period === p
                    ? "bg-zinc-800 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-4 gap-3">
          <ActionTile
            icon={ArrowLeftRight}
            label="Swap"
            onClick={() =>
              navigate({
                to: "/swap",
                search: isOusd ? {} : { token: tokenId },
              })
            }
          />
          <ActionTile
            icon={Send}
            label="Send"
            onClick={() => {
              if (isOusd) navigate({ to: "/send", search: { asset: "OUSD" } });
              else {
                toast.message("Send OpenToken from wallet address", {
                  description: "Copy your address from Receive, or use OpenDEX to swap to OUSD first.",
                });
                setReceiveOpen(true);
              }
            }}
          />
          <ActionTile icon={QrCode} label="Receive" onClick={() => setReceiveOpen(true)} />
          <ActionTile icon={MoreHorizontal} label="More" onClick={() => setMoreOpen(true)} />
        </div>

        {/* Position */}
        <section>
          <h2 className="mb-2 text-sm text-muted-foreground">Position</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-zinc-900/80 px-4 py-3">
              <div className="text-xs text-muted-foreground">Value</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-foreground">
                {formatUSD(valueUsd)}
              </div>
            </div>
            <div className="rounded-2xl bg-zinc-900/80 px-4 py-3">
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="mt-1 truncate text-xl font-bold tabular-nums text-foreground">
                {formatNumber(balance, balance < 1 ? 6 : 4)} {meta.symbol}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-2xl bg-zinc-900/80 px-4 py-3">
            <span className="text-sm text-muted-foreground">24h Change</span>
            <span className={cn("text-sm font-semibold tabular-nums", up ? "text-emerald-400" : "text-red-400")}>
              {up ? "+" : ""}
              {formatUSD(Math.abs(changeAbs))}
            </span>
          </div>
        </section>

        {/* Token address */}
        <section>
          <h2 className="mb-2 text-sm text-muted-foreground">Address</h2>
          <button
            type="button"
            onClick={() => meta.contract && copy(meta.contract, "Address copied")}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-zinc-900/80 px-4 py-3 text-left"
          >
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                {isOusd ? "Wallet address" : "Token / contract"}
              </div>
              <div className="mt-0.5 font-mono text-sm text-foreground">
                {shortAddress(meta.contract, 8, 8)}
              </div>
            </div>
            <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </section>

        {/* Info */}
        <section>
          <h2 className="mb-2 text-sm text-muted-foreground">Info</h2>
          <div className="overflow-hidden rounded-2xl bg-zinc-900/80">
            <InfoRow label="Name" value={meta.name} />
            <InfoRow label="Symbol" value={meta.symbol} />
            <InfoRow label="Network" value={meta.network} />
            {meta.marketCap != null && meta.marketCap > 0 && (
              <InfoRow label="Market Cap" value={formatOUSD(meta.marketCap, { compact: true })} />
            )}
            {meta.totalSupply != null && meta.totalSupply > 0 && (
              <InfoRow label="Total Supply" value={formatNumber(meta.totalSupply, 0)} />
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
            {!isOusd && <InfoRow label="Status" value={String(meta.status)} last />}
            {isOusd && <InfoRow label="Peg" value="$1.00 USD" last />}
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="mb-2 text-sm text-muted-foreground">About</h2>
          <p className="text-sm leading-relaxed text-foreground/90">{aboutPreview}</p>
          {meta.description.length > 140 && (
            <button
              type="button"
              className="mt-1 text-sm font-medium text-violet-400"
              onClick={() => setAboutOpen((v) => !v)}
            >
              {aboutOpen ? "Show Less" : "Show More"}
            </button>
          )}
          {meta.website && (
            <a
              href={meta.website}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-foreground hover:bg-zinc-800"
            >
              <Globe className="h-4 w-4" /> Website
            </a>
          )}
        </section>

        {!isOusd && (
          <section>
            <h2 className="mb-2 text-sm text-muted-foreground">24h Performance</h2>
            <div className="overflow-hidden rounded-2xl bg-zinc-900/80">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Volume</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatOUSD(Number(token?.volume_24h ?? 0), { compact: true })}
                  </span>
                  <span className={cn("text-sm font-medium", up ? "text-emerald-400" : "text-red-400")}>
                    {formatPct(meta.change)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border/40 px-4 py-3">
                <span className="text-sm text-muted-foreground">Holders</span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatNumber(token?.holder_count ?? 0, 0)}
                </span>
              </div>
            </div>
          </section>
        )}

        <p className="pb-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          Past performance is not an indicator of future performance. OpenPay Pro wallet balances
          reflect your OUSD and OpenToken holdings on this account.
        </p>
      </div>

      {/* Receive sheet */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Receive {meta.symbol}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="mx-auto grid h-48 w-48 place-items-center rounded-2xl border border-border bg-white p-3">
              {/* Lightweight QR via Google chart API for wallet address */}
              {wallet?.address ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(wallet.address)}`}
                  alt="Receive QR"
                  className="h-full w-full"
                />
              ) : (
                <QrCode className="h-16 w-16 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-muted/50 px-3 py-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{wallet?.name ?? "Main Wallet"}</div>
                <div className="truncate font-mono text-sm">({shortAddress(wallet?.address, 4, 4)})</div>
              </div>
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => wallet?.address && copy(wallet.address, "Wallet address copied")}
              >
                Copy
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {isOusd
                ? "Use this address to receive OUSD on OpenPay."
                : `Share your wallet address to receive $${meta.symbol}. Trading stays on OpenToken / OpenDEX.`}
            </p>
            <Button className="w-full rounded-full" variant="secondary" onClick={() => setReceiveOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* More menu */}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-border bg-card p-0">
          <div className="flex items-center justify-between px-4 pt-4">
            <button type="button" onClick={() => setMoreOpen(false)} className="text-muted-foreground">
              <X className="h-5 w-5" />
            </button>
            <DialogTitle className="sr-only">More</DialogTitle>
            <span />
          </div>
          <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-muted/40">
            {isOusd ? (
              <MoreRow
                icon={Sparkles}
                label="Earn with OUSD"
                onClick={() => {
                  setMoreOpen(false);
                  navigate({ to: "/ousd" });
                }}
              />
            ) : (
              <MoreRow
                icon={Sparkles}
                label="Trade on OpenToken"
                onClick={() => {
                  setMoreOpen(false);
                  navigate({ to: "/opentoken/$tokenId", params: { tokenId } });
                }}
              />
            )}
            <MoreRow
              icon={ArrowLeftRight}
              label="OpenDEX Swap"
              onClick={() => {
                setMoreOpen(false);
                navigate({ to: "/swap", search: isOusd ? {} : { token: tokenId } });
              }}
            />
            {meta.contract && (
              <MoreRow
                icon={ExternalLink}
                label="Copy token address"
                onClick={() => {
                  void copy(meta.contract!, "Address copied");
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
    </div>
  );
}

function ActionTile({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-2">
      <span className="grid h-14 w-full place-items-center rounded-2xl bg-zinc-900 text-violet-400 transition hover:bg-zinc-800">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </button>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3 text-sm",
        !last && "border-b border-border/40",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function MoreRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-border/40 px-4 py-3.5 text-left last:border-0 hover:bg-muted/50"
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-background text-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
