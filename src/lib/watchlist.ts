import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** asset_key formats: `major:btc`, `token:<uuid>`, `ousd` */
export type WatchAssetKey = string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export function majorWatchKey(id: string): WatchAssetKey {
  return `major:${id.toLowerCase()}`;
}

export function tokenWatchKey(tokenId: string): WatchAssetKey {
  return `token:${tokenId}`;
}

export function ousdWatchKey(): WatchAssetKey {
  return "ousd";
}

export function parseWatchKey(key: string): {
  kind: "major" | "token" | "ousd";
  id?: string;
} {
  if (key === "ousd") return { kind: "ousd" };
  if (key.startsWith("major:")) return { kind: "major", id: key.slice(6) };
  if (key.startsWith("token:")) return { kind: "token", id: key.slice(6) };
  return { kind: "token", id: key };
}

export function useWatchlist(userId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["watchlist", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db()
        .from("watchlist_items")
        .select("asset_key, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { asset_key: string; created_at: string }[];
    },
  });

  const keys = new Set((query.data ?? []).map((r) => r.asset_key));

  async function toggleWatch(assetKey: string): Promise<boolean> {
    if (!userId) throw new Error("Not signed in");
    const watched = keys.has(assetKey);
    if (watched) {
      const { error } = await db()
        .from("watchlist_items")
        .delete()
        .eq("user_id", userId)
        .eq("asset_key", assetKey);
      if (error) throw error;
      if (assetKey.startsWith("token:")) {
        await supabase
          .from("ot_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("token_id", assetKey.slice(6));
      }
    } else {
      const { error } = await db().from("watchlist_items").insert({
        user_id: userId,
        asset_key: assetKey,
      });
      if (error) throw error;
      if (assetKey.startsWith("token:")) {
        await supabase
          .from("ot_favorites")
          .upsert({ user_id: userId, token_id: assetKey.slice(6) });
      }
    }
    await qc.invalidateQueries({ queryKey: ["watchlist", userId] });
    await qc.invalidateQueries({ queryKey: ["ot-favorite"] });
    return !watched;
  }

  return {
    items: query.data ?? [],
    keys,
    isWatched: (assetKey: string) => keys.has(assetKey),
    toggleWatch,
    loading: query.isLoading,
  };
}
