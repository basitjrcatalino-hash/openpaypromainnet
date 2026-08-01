/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { TokenLiveChat } from "@/components/opentoken";
import {
  fetchMajorMarkets,
  getMajorToken,
  isMajorTokenId,
  majorMarketById,
} from "@/lib/major-tokens";
import {
  fetchListedSolanaMarkets,
  getListedSolanaToken,
  isListedSolanaTokenId,
  listedSolanaMarketById,
} from "@/lib/listed-solana-tokens";
import { isPerpMarket } from "@/lib/perp";
import { OUSD_LOGO_URL } from "@/lib/token-logos";

export const Route = createFileRoute("/_authenticated/asset_/$tokenId/chat")({
  head: ({ params }) => ({
    meta: [{ title: `Live Chat · ${params.tokenId} — OpenPay Pro` }],
  }),
  component: AssetLiveChatPage,
});

/**
 * Phantom-style live chat for every asset: majors, OUSD, listed Solana, OpenTokens.
 * Header shows live price + 24h change; Trade opens /trade (perps) or asset page.
 */
function AssetLiveChatPage() {
  const { tokenId: rawId } = Route.useParams();
  const tokenId = decodeURIComponent(rawId);
  const { user } = Route.useRouteContext();
  const router = useRouter();

  const isOusd = tokenId === "ousd" || tokenId === "__ousd__";
  const isMajor = isMajorTokenId(tokenId);
  const isListed = isListedSolanaTokenId(tokenId);
  const majorDef = isMajor ? getMajorToken(tokenId) : null;
  const listedDef = isListed ? getListedSolanaToken(tokenId) : null;
  const roomId = (isOusd ? "ousd" : tokenId).toLowerCase();

  const { data: majorMarkets } = useQuery({
    queryKey: ["major-markets"],
    staleTime: 30_000,
    refetchInterval: 45_000,
    enabled: isMajor || isOusd,
    queryFn: () => fetchMajorMarkets(),
  });

  const { data: listedMarkets } = useQuery({
    queryKey: ["listed-solana-markets"],
    staleTime: 30_000,
    refetchInterval: 45_000,
    enabled: isListed,
    queryFn: fetchListedSolanaMarkets,
  });

  const { data: otToken, isLoading: otLoading } = useQuery({
    queryKey: ["ot-token", tokenId],
    enabled: !isOusd && !isMajor && !isListed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("id, name, symbol, logo_url, price_usd, change_24h")
        .eq("id", tokenId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const meta = useMemo(() => {
    if (isOusd) {
      return {
        name: "OpenUSD",
        symbol: "OUSD",
        logoUrl: OUSD_LOGO_URL,
        priceUsd: 1,
        change24h: 0,
      };
    }
    if (isMajor && majorDef) {
      const m = majorMarketById(majorMarkets, majorDef.id);
      return {
        name: majorDef.name,
        symbol: majorDef.symbol,
        logoUrl: majorDef.logoUrl,
        priceUsd: Number(m.price ?? 0),
        change24h: Number(m.change24h ?? 0),
      };
    }
    if (isListed && listedDef) {
      const m = listedSolanaMarketById(listedMarkets, listedDef.id);
      return {
        name: listedDef.name,
        symbol: listedDef.symbol,
        logoUrl: m.logoUrl ?? listedDef.logoUrl,
        priceUsd: Number(m.price ?? 0),
        change24h: Number(m.change24h ?? 0),
      };
    }
    if (otToken) {
      return {
        name: otToken.name,
        symbol: otToken.symbol,
        logoUrl: otToken.logo_url,
        priceUsd: Number(otToken.price_usd ?? 0),
        change24h: Number(otToken.change_24h ?? 0),
      };
    }
    return null;
  }, [isOusd, isMajor, isListed, majorDef, listedDef, majorMarkets, listedMarkets, otToken]);

  if (!isOusd && !isMajor && !isListed && otLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black">
        <Loader2 className="h-5 w-5 animate-spin text-white/50" />
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-black px-4 text-center">
        <p className="text-sm text-white/50">Token not found</p>
        <button
          type="button"
          className="text-sm font-semibold text-[#ABA3FF]"
          onClick={() => void router.navigate({ to: "/tokens" })}
        >
          Back to Tokens
        </button>
      </div>
    );
  }

  const canPerp = isPerpMarket(meta.symbol);

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-black">
      <TokenLiveChat
        variant="page"
        className="h-full min-h-0 flex-1"
        tokenId={tokenId}
        roomId={roomId}
        userId={user.id}
        name={meta.name}
        symbol={meta.symbol}
        logoUrl={meta.logoUrl}
        priceUsd={meta.priceUsd}
        change24h={meta.change24h}
        onClose={() => {
          void router.navigate({
            to: "/asset/$tokenId",
            params: { tokenId },
          });
        }}
        onTrade={() => {
          if (canPerp) {
            void router.navigate({
              to: "/trade",
              search: { market: meta.symbol },
            });
            return;
          }
          if (isListed && listedDef?.phantomUrl) {
            window.open(listedDef.phantomUrl, "_blank", "noopener,noreferrer");
            return;
          }
          void router.navigate({
            to: "/asset/$tokenId",
            params: { tokenId },
          });
        }}
      />
    </div>
  );
}
