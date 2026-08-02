/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { GlobalLiveChat } from "@/components/wallet/GlobalLiveChat";

export const Route = createFileRoute("/_authenticated/opentoken_/$tokenId_/chat")({
  head: () => ({ meta: [{ title: "Live Chat — OpenToken" }] }),
  component: TokenLiveChatPage,
});

/** Same Global Live Chat UI — OpenToken name, logo, and live price. */
function TokenLiveChatPage() {
  const { tokenId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const router = useRouter();

  const { data: token, isLoading } = useQuery({
    queryKey: ["ot-token", tokenId],
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

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token) {
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
        room={{
          id: String(token.id).toLowerCase(),
          name: token.name,
          symbol: token.symbol,
          logoUrl: token.logo_url,
          priceUsd: Number(token.price_usd ?? 0),
          change24h: Number(token.change_24h ?? 0),
        }}
        onBack={() => {
          void router.navigate({ to: "/chat" });
        }}
      />
    </div>
  );
}
