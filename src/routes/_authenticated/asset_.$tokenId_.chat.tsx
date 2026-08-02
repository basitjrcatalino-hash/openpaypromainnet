/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { GlobalLiveChat } from "@/components/wallet/GlobalLiveChat";
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
 * Exact Global Live Chat UI per token — name, logo, live price in the header.
 * Route: `/asset/$tokenId/chat` — one `asset_chat_messages` room per token.
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
  const roomId = isOusd ? "ousd" : tokenId.toLowerCase();

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
        id: "ousd",
        name: "OpenUSD",
        symbol: "OUSD",
        logoUrl: OUSD_LOGO_URL,
        priceUsd: 1,
        change24h: 0,
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
      return {
        id: roomId,
        name: majorDef.name,
        symbol: majorDef.symbol,
        logoUrl: majorDef.logoUrl,
        priceUsd: price,
        change24h: change,
      };
    }
    if (otToken) {
      return {
        id: String(otToken.id).toLowerCase(),
        name: otToken.name,
        symbol: otToken.symbol,
        logoUrl: otToken.logo_url,
        priceUsd: Number(otToken.price_usd ?? 0),
        change24h: Number(otToken.change_24h ?? 0),
      };
    }
    return null;
  }, [isOusd, isMajor, majorDef, majorMarkets, otToken, perpQuotes, perpSym, roomId]);

  if (!isOusd && !isMajor && otLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <p className="text-sm text-muted-foreground">Token not found</p>
        <button
          type="button"
          className="text-sm font-semibold text-primary"
          onClick={() => void router.navigate({ to: "/chat" })}
        >
          Back to Live Chat
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background">
      <GlobalLiveChat
        fill
        className="h-full min-h-0 flex-1"
        userId={user.id}
        room={meta}
        onBack={() => {
          void router.navigate({ to: "/chat" });
        }}
      />
    </div>
  );
}
