import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Fuel, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { arcBalance } from "@/lib/arc-wallet";

/** Compact Arc wallet summary: linked address, live Arc USDC balance, USDC-gas note. */
export function ArcWalletCard() {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return setReady(true);
      const { data: link } = await supabase.from("arc_wallet_links").select("address").eq("user_id", data.user.id).limit(1).maybeSingle();
      setAddress((link?.address as `0x${string}` | undefined) ?? null);
      setReady(true);
    });
  }, []);
  const balance = useQuery({ queryKey: ["arc-balance", address], queryFn: () => arcBalance(address!), enabled: !!address, refetchInterval: 30_000, retry: false });
  if (!ready) return null;
  return (
    <Link to="/arc" className="my-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Wallet className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Arc Wallet</span>
        {address ? (
          <span className="block truncate text-sm text-muted-foreground tabular-nums">
            {balance.isError ? "Balance unavailable" : balance.isPending ? "…" : `${Number(balance.data).toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC`} · {address.slice(0, 6)}…{address.slice(-4)}
          </span>
        ) : (
          <span className="block text-sm text-muted-foreground">Connect a wallet to use Arc</span>
        )}
        <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Fuel className="h-3 w-3" />Network fees paid in USDC</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
