"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ImageIcon, Loader2, Send, Smile, Sticker } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/wallet-utils";

type ChatKind = "text" | "gif" | "sticker" | "emoji";

type ChatRow = {
  id: string;
  body: string;
  kind: ChatKind;
  media_url: string | null;
  created_at: string;
  user_id: string;
  profile?: { display_name?: string | null; username?: string | null; avatar_url?: string | null };
};

const EMOJI_STICKERS = [
  "🚀",
  "💎",
  "🔥",
  "📈",
  "🐸",
  "💰",
  "🧠",
  "⚡",
  "🌙",
  "🫡",
  "👑",
  "🎯",
];

/** Curated reaction GIFs (public Giphy media). */
const PUMP_GIFS = [
  {
    id: "rocket",
    label: "Rocket",
    url: "https://media.giphy.com/media/26tPplGWjN0xLybiU/giphy.gif",
  },
  {
    id: "pump",
    label: "Pump",
    url: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
  },
  {
    id: "moon",
    label: "Moon",
    url: "https://media.giphy.com/media/l0MYt5jPRVEpTyBjS/giphy.gif",
  },
  {
    id: "dance",
    label: "Dance",
    url: "https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif",
  },
  {
    id: "cash",
    label: "Cash",
    url: "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif",
  },
  {
    id: "fire",
    label: "Fire",
    url: "https://media.giphy.com/media/l0MYC0LajbuPoQ4Ne/giphy.gif",
  },
];

export function TokenLiveChat({ tokenId, userId }: { tokenId: string; userId: string }) {
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"none" | "emoji" | "gif">("none");
  const [gifUrl, setGifUrl] = useState("");

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["ot-live-chat", tokenId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ot_token_chat_messages")
        .select("id, body, kind, media_url, created_at, user_id")
        .eq("token_id", tokenId)
        .order("created_at", { ascending: true })
        .limit(120);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((c) => c.user_id))];
      const profiles: Record<string, ChatRow["profile"]> = {};
      if (ids.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", ids);
        for (const p of ps ?? []) profiles[p.id] = p;
      }
      return (data ?? []).map((c) => ({
        ...c,
        kind: (c.kind as ChatKind) || "text",
        profile: profiles[c.user_id],
      })) as ChatRow[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`ot-chat-${tokenId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ot_token_chat_messages",
          filter: `token_id=eq.${tokenId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["ot-live-chat", tokenId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tokenId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(payload: {
    kind: ChatKind;
    body: string;
    media_url?: string | null;
  }) {
    const text = payload.body.trim();
    if (!text && !payload.media_url) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("ot_token_chat_messages").insert({
        token_id: tokenId,
        user_id: userId,
        kind: payload.kind,
        body: text || payload.kind,
        media_url: payload.media_url ?? null,
      });
      if (error) throw error;
      setBody("");
      setGifUrl("");
      setPanel("none");
      await qc.invalidateQueries({ queryKey: ["ot-live-chat", tokenId] });
    } catch (err) {
      const msg = (err as Error).message || "Could not send";
      if (/relation|ot_token_chat_messages|schema cache/i.test(msg)) {
        toast.error("Live chat needs a DB migration — run ot_token_chat_messages on Supabase");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[min(28rem,70vh)] flex-col overflow-hidden rounded-2xl border border-border/50 bg-muted/20">
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold">Live chat</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{messages.length} msgs</span>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading chat…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Be first to pump — send a message, sticker, or GIF.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex gap-2">
              <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-[11px] font-bold">
                {m.profile?.avatar_url ? (
                  <img src={m.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (m.profile?.username || m.profile?.display_name || "?").slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-[11px] text-muted-foreground">
                  <Link
                    to="/opentoken/creator/$userId"
                    params={{ userId: m.user_id }}
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    {m.profile?.username || m.profile?.display_name || "Trader"}
                  </Link>
                  <span>{timeAgo(m.created_at)}</span>
                </div>
                {m.kind === "emoji" || m.kind === "sticker" ? (
                  <p className="text-3xl leading-none">{m.body}</p>
                ) : m.media_url ? (
                  <div className="mt-1 space-y-1">
                    {m.body && m.kind === "text" ? (
                      <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                    ) : null}
                    <img
                      src={m.media_url}
                      alt=""
                      className="max-h-40 max-w-[220px] rounded-xl object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {panel === "emoji" && (
        <div className="grid grid-cols-6 gap-1 border-t border-border/50 bg-card px-2 py-2">
          {EMOJI_STICKERS.map((e) => (
            <button
              key={e}
              type="button"
              className="grid h-10 place-items-center rounded-lg text-xl hover:bg-muted press"
              onClick={() => void send({ kind: "emoji", body: e })}
              disabled={busy}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {panel === "gif" && (
        <div className="space-y-2 border-t border-border/50 bg-card px-2 py-2">
          <div className="grid grid-cols-3 gap-1.5">
            {PUMP_GIFS.map((g) => (
              <button
                key={g.id}
                type="button"
                className="overflow-hidden rounded-lg border border-border/40 hover:border-primary/50 press"
                onClick={() => void send({ kind: "gif", body: g.label, media_url: g.url })}
                disabled={busy}
              >
                <img src={g.url} alt={g.label} className="h-16 w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              value={gifUrl}
              onChange={(e) => setGifUrl(e.target.value)}
              placeholder="Paste GIF / image URL…"
              className="h-9 rounded-xl text-xs"
            />
            <Button
              type="button"
              size="sm"
              className="h-9 rounded-xl"
              disabled={busy || !/^https?:\/\//i.test(gifUrl.trim())}
              onClick={() =>
                void send({ kind: "gif", body: "GIF", media_url: gifUrl.trim() })
              }
            >
              Send
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 border-t border-border/50 bg-card px-2 py-2">
        <button
          type="button"
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted",
            panel === "emoji" && "bg-muted text-foreground",
          )}
          onClick={() => setPanel((p) => (p === "emoji" ? "none" : "emoji"))}
          aria-label="Stickers"
        >
          <Smile className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted",
            panel === "gif" && "bg-muted text-foreground",
          )}
          onClick={() => setPanel((p) => (p === "gif" ? "none" : "gif"))}
          aria-label="GIFs"
        >
          <Sticker className="h-4 w-4" />
        </button>
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 500))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send({ kind: "text", body });
            }
          }}
          placeholder="Pump in the chat…"
          className="h-9 flex-1 rounded-full border-0 bg-muted text-sm"
        />
        <Button
          type="button"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          disabled={busy || !body.trim()}
          onClick={() => void send({ kind: "text", body })}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

/** Alias icon export for headers that want an image affordance. */
export function TokenLiveChatIcon(props: { className?: string }) {
  return <ImageIcon className={props.className} />;
}
