import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeftRight,
  ChartNoAxesCombined,
  Coins,
  ExternalLink,
  Loader2,
  Rocket,
} from "lucide-react";

import { PageHeader } from "@/components/wallet/PageHeader";
import { BagsAuthCard } from "@/components/bags/BagsAuthCard";
import { BagsCashIcon } from "@/components/bags/BagsCashIcon";
import { BagsWalletBar } from "@/components/bags/BagsWalletBar";
import { Button } from "@/components/ui/button";
import { bagsPing, bagsTopTokens } from "@/lib/bags.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/bags")({
  head: () => ({ meta: [{ title: "Bags Cash — OpenPay Pro" }] }),
  component: BagsHubPage,
});

type BagsTopToken = {
  tokenMint: string;
  name: string;
  symbol: string;
  lifetimeFees: string;
  image: string;
};

const ACTIONS = [
  {
    to: "/bags/launch" as const,
    label: "Launch",
    desc: "Create a Bags token on Solana",
    icon: Rocket,
  },
  {
    to: "/bags/trade" as const,
    label: "Trade",
    desc: "Quote and swap via Bags",
    icon: ArrowLeftRight,
  },
  {
    to: "/bags/fees" as const,
    label: "Fees",
    desc: "Claim creator & partner fees",
    icon: Coins,
  },
];

function BagsHubPage() {
  const pingFn = useServerFn(bagsPing);
  const topFn = useServerFn(bagsTopTokens);

  const { data: ping, isLoading: pingLoading } = useQuery({
    queryKey: ["bags-ping"],
    queryFn: () => pingFn(),
    staleTime: 60_000,
    retry: 1,
  });

  const { data: top, isLoading: topLoading } = useQuery({
    queryKey: ["bags-top-tokens"],
    queryFn: () => topFn(),
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <div className="mx-auto w-full max-w-lg pb-8">
      <PageHeader title="Bags Cash" backTo="/dashboard" />

      <div className="mb-4 overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#0c0f0d] p-4 text-white shadow-[inset_0_1px_0_rgba(52,211,153,0.12)]">
        <div className="mb-1 flex items-center gap-2 text-lg font-bold tracking-tight">
          <BagsCashIcon className="h-6 w-6" />
          Bags on Solana
        </div>
        <p className="text-sm text-white/55">
          Launch, trade, and claim fees via the{" "}
          <a
            href="https://docs.bags.fm/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-emerald-400 underline-offset-2 hover:underline"
          >
            Bags API
          </a>
          . Trades are signed in Phantom.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {pingLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />
          ) : ping?.ok ? (
            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300">
              API {ping.message}
            </span>
          ) : (
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-200">
              API not reachable — check BAGS_API_KEY
            </span>
          )}
          {ping?.partnerConfig ? (
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-200/90">
              Partner key linked
            </span>
          ) : null}
          {ping?.partnerRefUrl ? (
            <a
              href={ping.partnerRefUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-emerald-400 underline-offset-2 hover:underline"
            >
              bags.fm/?ref={ping.partnerRef || "mrwain"}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>

      <BagsAuthCard />
      <BagsWalletBar className="mb-4 border border-white/5 bg-[#121512]" />

      <div className="mb-6 grid gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.to}
              to={action.to}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-[#121512] px-4 py-3 press transition-colors hover:border-emerald-500/30"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{action.label}</span>
                <span className="block text-xs text-muted-foreground">{action.desc}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mb-2 flex items-center gap-2">
        <ChartNoAxesCombined className="h-4 w-4 text-emerald-400" />
        <h2 className="text-sm font-bold uppercase tracking-wide">Launch feed</h2>
      </div>

      {topLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !top?.tokens?.length ? (
        <p className="rounded-2xl border border-white/5 bg-[#121512] px-3 py-4 text-center text-sm text-muted-foreground">
          No launch feed data yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {top.tokens.slice(0, 12).map((token: BagsTopToken, i: number) => {
            const mint = token.tokenMint;
            if (!mint) return null;
            return (
              <li key={mint}>
                <Link
                  to="/bags/token/$mint"
                  params={{ mint }}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border border-white/5 bg-[#121512] px-3 py-2.5 press hover:border-emerald-500/25",
                  )}
                >
                  {token.image ? (
                    <img
                      src={token.image}
                      alt=""
                      className="h-9 w-9 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="w-6 text-center text-xs font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {token.name || token.symbol || mint.slice(0, 8)}
                      {token.symbol ? (
                        <span className="ml-1 text-muted-foreground">${token.symbol}</span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground tabular-nums">
                      {token.lifetimeFees || "—"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 flex justify-center">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="rounded-full text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
        >
          <a href="https://bags.fm" target="_blank" rel="noreferrer">
            Open bags.fm
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </div>
  );
}
