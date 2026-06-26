import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Image as ImageIcon, Sparkles, TrendingUp } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/wallet-utils";

export const Route = createFileRoute("/_authenticated/nfts")({
  head: () => ({ meta: [{ title: "NFTs — OpenPay Pro Wallet" }] }),
  component: NFTPage,
});

function NFTPage() {
  const { data: collections = [] } = useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const { data } = await supabase.from("nft_collections").select("*").order("is_featured", { ascending: false });
      return data ?? [];
    },
  });

  const { data: nfts = [] } = useQuery({
    queryKey: ["nfts-listed"],
    queryFn: async () => {
      const { data } = await supabase.from("nfts").select("*").order("minted_at", { ascending: false }).limit(12);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">NFT Marketplace</h1>
          <p className="text-sm text-muted-foreground">Discover, collect and mint on OpenPay</p>
        </div>
        <Button asChild className="rounded-full bg-gradient-primary text-primary-foreground shadow-glow">
          <Link to="/nfts/mint"><Plus className="mr-1.5 h-4 w-4" /> Mint NFT</Link>
        </Button>
      </div>

      <Card className="glass-strong overflow-hidden rounded-3xl border-border/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Featured Collections</h2>
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        {collections.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No collections yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {collections.map((c: any) => (
              <div key={c.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                <div className="h-24 bg-gradient-primary" />
                <div className="-mt-8 px-4 pb-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl border-4 border-card bg-gradient-mint text-xs font-bold text-mint-foreground">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="mt-2 text-sm font-semibold">{c.name}</div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Floor</span>
                    <span className="font-semibold">{formatNumber(c.floor_price, 2)} OUSD</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Volume</span>
                    <span className="font-semibold">{formatNumber(c.total_volume, 0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">New &amp; Trending</h2>
          <TrendingUp className="h-4 w-4 text-mint" />
        </div>
        {nfts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><ImageIcon className="h-5 w-5" /></span>
            <div className="text-sm font-semibold">No NFTs yet</div>
            <p className="text-xs text-muted-foreground">Be the first to mint a piece.</p>
            <Button asChild size="sm" className="mt-2 rounded-full bg-gradient-primary text-primary-foreground">
              <Link to="/nfts/mint">Mint NFT</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {nfts.map((n: any) => (
              <div key={n.id} className="group overflow-hidden rounded-2xl border border-border/60 bg-card transition hover:-translate-y-0.5 hover:shadow-glow">
                <div className="aspect-square w-full bg-gradient-mint" />
                <div className="p-3">
                  <div className="truncate text-sm font-semibold">{n.name}</div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-semibold">{formatNumber(n.price, 2)} OUSD</span>
                  </div>
                  <Button size="sm" className="mt-2 w-full rounded-full bg-gradient-primary text-primary-foreground">Buy</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
