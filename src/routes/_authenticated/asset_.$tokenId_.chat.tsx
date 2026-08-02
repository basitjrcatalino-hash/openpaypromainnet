/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { TokenLiveChat } from "@/components/opentoken";
import {
  fetchMajorMarkets,
  getMajorToken,
  isMajorTokenId,
  majorMarketById,
} from "@/lib/major-tokens";
import { getPerpLiveQuotes } from "@/lib/perp-market.functions";
import { isPerpMarket } from "@/lib/perp";
import { quoteByMarket } from "@/lib/tradingview-perps";
import { OUSD_LOGO_URL } from "@/lib/token-logos";

export const Route = createFileRoute("/_authenticated/asset_/$tokenId_/chat")({
  head: ({ params }) => ({
    meta: [{ title: `Live Chat · ${params.tokenId} — OpenPay Pro` }],
  }),
  component: AssetLiveChatPage,
});

/**
 * Phantom-style live chat for every asset: majors, OUSD, OpenTokens.
 * Route: `/asset/$tokenId/chat` — one room per token (room_id = major id / ousd / OT uuid).
 * Header shows live price + 24h change; Trade opens /trade (perps) or asset page.
 */
function AssetLiveChatPage() {
  const { tokenId: rawId } = Route.useParams();
  const tokenId = decodeURIComponent(rawId);
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const fetchQuotes = useServerFn(getPerpLiveQuotes);

  const isOusd = tokenId === "ousd" || tokenId === "__ousd__";
  const isMajor = isMajorTokenId(tokenId);
  const majorDef = isMajor ? getMajorToken(tokenId) : null;
  // Majors / OUSD → asset_chat_messages.room_id (one room per asset).
  // OpenToken UUIDs omit roomId so TokenLiveChat uses ot_token_chat_messages (per token).
  const roomId = isOusd ? "ousd" : isMajor ? tokenId.toLowerCase() : undefined;

  const { data: majorMarkets } = useQuery({
    queryKey: ["major-markets"],
    staleTime: 20_000,
    refetchInterval: 30_000,
    enabled: isMajor || isOusd,
    queryFn: () => fetchMajorMarkets(),
  });

  const perpSym = majorDef?.symbol && isPerpMarket(majorDef.symbol) ? majorDef.symbol : null;
  const { data: perpQuotes } = useQuery({
    queryKey: ["perp-live-quotes"],
    staleTime: 8_000,
    refetchInterval: 12_000,
    enabled: Boolean(perpSym),
    queryFn: () => fetchQuotes(),
    retry: 1,
  });

  const { data: otToken, isLoading: otLoading } = useQuery({
    queryKey: ["ot-token", tokenId],
    enabled: !isOusd && !isMajor,
    refetchInterval: 30_000,
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
        changeAbs: 0,
      };
    }
    if (isMajor && majorDef) {
      const m = majorMarketById(majorMarkets, majorDef.id);
      const q = perpSym ? quoteByMarket(perpQuotes, perpSym) : null;
      const price =
        q?.markPrice && q.markPrice > 0
          ? q.markPrice
          : q?.price && q.price > 0
            ? q.price
            : Number(m.price ?? 0);
      const change =
        q != null && Number.isFinite(q.change24h) ? q.change24h : Number(m.change24h ?? 0);
      const changeAbs =
        q?.changeAbs != null && Number.isFinite(q.changeAbs)
          ? q.changeAbs
          : price > 0
            ? (price * change) / 100
            : 0;
      return {
        name: majorDef.name,
        symbol: majorDef.symbol,
        logoUrl: majorDef.logoUrl,
        priceUsd: price,
        change24h: change,
        changeAbs,
      };
    }
    if (otToken) {
      const price = Number(otToken.price_usd ?? 0);
      const change = Number(otToken.change_24h ?? 0);
      return {
        name: otToken.name,
        symbol: otToken.symbol,
        logoUrl: otToken.logo_url,
        priceUsd: price,
        change24h: change,
        changeAbs: price > 0 ? (price * change) / 100 : 0,
      };
    }
    return null;
  }, [isOusd, isMajor, majorDef, majorMarkets, otToken, perpQuotes, perpSym]);

  if (!isOusd && !isMajor && otLoading) {
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
        changeAbs={meta.changeAbs}
        onClose={() => {
          void router.navigate({ to: "/chat" });
        }}
        onTrade={() => {
          if (canPerp) {
            void router.navigate({
              to: "/trade",
              search: { market: meta.symbol, mode: "futures" },
            });
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
