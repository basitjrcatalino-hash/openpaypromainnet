import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export type OrbitPost = {
  id: string;
  user_id: string;
  body: string;
  symbol: string | null;
  created_at: string;
  likes: number;
  liked: boolean;
  author: { name: string; avatar: string | null };
};

/** Orbit community feed — posts + likes, read publicly, written as the signed-in user. */
export function useOrbitFeed(userId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["orbit-feed", userId ?? "anon"],
    queryFn: async (): Promise<OrbitPost[]> => {
      const { data: posts, error } = await db()
        .from("exchange_posts")
        .select("id, user_id, body, symbol, created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      const rows = (posts ?? []) as Array<{
        id: string;
        user_id: string;
        body: string;
        symbol: string | null;
        created_at: string;
      }>;
      if (!rows.length) return [];

      const ids = rows.map((r) => r.id);
      const authorIds = Array.from(new Set(rows.map((r) => r.user_id)));

      const [{ data: likes }, { data: profiles }] = await Promise.all([
        db().from("exchange_post_likes").select("post_id, user_id").in("post_id", ids),
        db().from("profiles").select("id, display_name, username, avatar_url").in("id", authorIds),
      ]);

      const likeRows = (likes ?? []) as Array<{ post_id: string; user_id: string }>;
      const profileRows = (profiles ?? []) as Array<{
        id: string;
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
      }>;
      const byAuthor = new Map(profileRows.map((p) => [p.id, p]));

      return rows.map((r) => {
        const mine = likeRows.filter((l) => l.post_id === r.id);
        const p = byAuthor.get(r.user_id);
        return {
          ...r,
          likes: mine.length,
          liked: !!userId && mine.some((l) => l.user_id === userId),
          author: {
            name: p?.username || p?.display_name || "Trader",
            avatar: p?.avatar_url ?? null,
          },
        };
      });
    },
    refetchInterval: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["orbit-feed", userId ?? "anon"] });

  const createPost = async (body: string, symbol: string | null) => {
    if (!userId) throw new Error("Sign in to post");
    const { error } = await db()
      .from("exchange_posts")
      .insert({ user_id: userId, body: body.trim().slice(0, 2000), symbol });
    if (error) throw error;
    await invalidate();
  };

  const toggleLike = async (postId: string, liked: boolean) => {
    if (!userId) throw new Error("Sign in to like");
    const table = db().from("exchange_post_likes");
    const { error } = liked
      ? await table.delete().eq("post_id", postId).eq("user_id", userId)
      : await table.insert({ post_id: postId, user_id: userId });
    if (error) throw error;
    await invalidate();
  };

  const deletePost = async (postId: string) => {
    const { error } = await db().from("exchange_posts").delete().eq("id", postId);
    if (error) throw error;
    await invalidate();
  };

  return { posts: query.data ?? [], isLoading: query.isLoading, createPost, toggleLike, deletePost };
}
