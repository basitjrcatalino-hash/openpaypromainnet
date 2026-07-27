import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/wallet-utils";

export function CommentThread({ tokenId, userId }: { tokenId: string; userId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["ot-comments", tokenId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ot_comments")
        .select("id, body, created_at, user_id")
        .eq("token_id", tokenId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((c) => c.user_id))];
      const profiles: Record<string, any> = {};
      if (ids.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", ids);
        for (const p of ps ?? []) profiles[p.id] = p;
      }
      return (data ?? []).map((c) => ({ ...c, profile: profiles[c.user_id] }));
    },
  });

  async function post() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("ot_comments").insert({
        token_id: tokenId,
        user_id: userId,
        body: text,
      });
      if (error) throw error;
      setBody("");
      await qc.invalidateQueries({ queryKey: ["ot-comments", tokenId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 1000))}
          placeholder="Share an update…"
          className="min-h-18 rounded-xl"
        />
        <Button
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full bg-gradient-primary text-primary-foreground"
          disabled={busy || !body.trim()}
          onClick={post}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading comments…</div>
      ) : comments.length === 0 ? (
        <div className="text-sm text-muted-foreground">No comments yet</div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c: any) => (
            <li key={c.id} className="rounded-xl border border-border/50 bg-card/40 p-3">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <Link
                  to="/opentoken/creator/$userId"
                  params={{ userId: c.user_id }}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {c.profile?.username || c.profile?.display_name || "Trader"}
                </Link>
                <span>{timeAgo(c.created_at)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
