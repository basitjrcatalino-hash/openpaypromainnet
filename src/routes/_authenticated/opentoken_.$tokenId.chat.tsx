/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { TokenLiveChat, TradePanel } from "@/components/opentoken";
import { TokenTradeSheet } from "@/components/opentoken/TokenTradeBar";
import { fetchActiveWallet } from "@/lib/wallet-utils";

export const Route = createFileRoute("/_authenticated/opentoken_/$tokenId/chat")({
  head: () => ({ meta: [{ title: "Live Chat — OpenToken" }] }),
  component: TokenLiveChatPage,
});

function TokenLiveChatPage() {
  const { tokenId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const [showBuy, setShowBuy] = useState(false);

  const { data: token, isLoading } = useQuery({
    queryKey: ["ot-token", tokenId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("*")
        .eq("id", tokenId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: () =>
      fetchActiveWallet<{ id: string; ousd_balance?: number | null }>(
        supabase,
        user.id,
        "id, ousd_balance",
      ),
  });

  const { data: holding = 0 } = useQuery({
    queryKey: ["ot-holding", tokenId, wallet?.id],
    enabled: Boolean(wallet?.id),
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

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="ot-phantom ph-page flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-muted-foreground">Token not found</p>
        <button
          type="button"
          className="text-sm font-semibold text-primary"
          onClick={() => void router.navigate({ to: "/opentoken" })}
        >
          Back to OpenToken
        </button>
      </div>
    );
  }

  const price = Number(token.price_usd ?? 0);
  const change = Number(token.change_24h ?? 0);
  const backTo = `/opentoken/${tokenId}`;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black md:static md:inset-auto md:z-auto md:h-[calc(100dvh-6rem)] md:overflow-hidden md:rounded-3xl md:border md:border-white/10">
      <TokenLiveChat
        variant="page"
        className="h-full min-h-0 flex-1"
        tokenId={tokenId}
        userId={user.id}
        name={token.name}
        symbol={token.symbol}
        logoUrl={token.logo_url}
        priceUsd={price}
        change24h={change}
        onClose={() => {
          void router.navigate({ to: "/opentoken/$tokenId", params: { tokenId } });
        }}
        onTrade={() => setShowBuy(true)}
      />

      <TokenTradeSheet open={showBuy} onClose={() => setShowBuy(false)}>
        <TradePanel
          token={token}
          walletId={wallet?.id}
          userId={user.id}
          ousdBalance={Number(wallet?.ousd_balance ?? 0)}
          tokenBalance={holding}
          onClose={() => setShowBuy(false)}
          returnPath={backTo}
        />
      </TokenTradeSheet>
    </div>
  );
}
