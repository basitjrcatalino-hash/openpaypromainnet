import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Community rooms (global chat, token chat, token comments, Orbit feed).
 * The tables only allow authors and staff to read rows directly; signed-in members
 * get each room's recent messages here, with fixed columns and row limits.
 */
async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const TokenInput = z.object({ tokenId: z.string().uuid() });

export type CommunityChatRow = {
  id: string;
  body: string;
  kind: string | null;
  media_url: string | null;
  created_at: string;
  user_id: string;
};

export const listGlobalChatMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<CommunityChatRow[]> => {
    const db = await adminClient();
    const { data, error } = await db
      .from("global_chat_messages")
      .select("id, body, kind, media_url, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Could not load chat");
    return ((data ?? []) as CommunityChatRow[]).reverse();
  });

export const listTokenChatMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }): Promise<CommunityChatRow[]> => {
    const db = await adminClient();
    const { data: rows, error } = await db
      .from("ot_token_chat_messages")
      .select("id, body, kind, media_url, created_at, user_id")
      .eq("token_id", data.tokenId)
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw new Error("Could not load chat");
    return ((rows ?? []) as CommunityChatRow[]).reverse();
  });

export const listTokenComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const db = await adminClient();
    const { data: rows, error } = await db
      .from("ot_comments")
      .select("id, body, created_at, user_id")
      .eq("token_id", data.tokenId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load comments");
    return (rows ?? []) as { id: string; body: string; created_at: string; user_id: string }[];
  });

export const countTokenComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const db = await adminClient();
    const { count, error } = await db
      .from("ot_comments")
      .select("id", { count: "exact", head: true })
      .eq("token_id", data.tokenId);
    if (error) throw new Error("Could not count comments");
    return count ?? 0;
  });

export const listOrbitFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const db = await adminClient();
    const { data: posts, error } = await (db as any)
      .from("exchange_posts")
      .select("id, user_id, body, symbol, created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error("Could not load posts");
    const rows = (posts ?? []) as Array<{
      id: string;
      user_id: string;
      body: string;
      symbol: string | null;
      created_at: string;
    }>;
    if (!rows.length) return { posts: rows, likes: [] as { post_id: string; user_id: string }[] };
    const { data: likes } = await (db as any)
      .from("exchange_post_likes")
      .select("post_id, user_id")
      .in(
        "post_id",
        rows.map((r) => r.id),
      );
    return { posts: rows, likes: (likes ?? []) as { post_id: string; user_id: string }[] };
  });
