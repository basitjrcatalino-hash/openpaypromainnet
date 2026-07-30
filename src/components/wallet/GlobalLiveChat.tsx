import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, Search, Smile, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchKlipyMedia, type KlipyMediaItem } from "@/lib/klipy";
import { OUSD_LOGO_URL } from "@/lib/token-logos";

type ChatKind = "text" | "gif" | "sticker" | "emoji";

type ProfileBits = {
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

type ChatRow = {
  id: string;
  body: string;
  kind: ChatKind;
  media_url: string | null;
  created_at: string;
  user_id: string;
  profile?: ProfileBits;
};

const EMOJI_QUICK = ["🚀", "💎", "🔥", "📈", "🐸", "💰", "⚡", "🌙", "🫡", "👑", "😂", "💀"];

function errMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message ?? "");
  }
  return String(err);
}

function isMissingTable(message: string) {
  return /relation|global_chat_messages|schema cache|does not exist|Could not find the table/i.test(
    message,
  );
}

function displayNameOf(profile: ProfileBits | undefined, userId: string) {
  return profile?.display_name?.trim() || profile?.username?.trim() || "OpenPay user";
}

function usernameOf(profile: ProfileBits | undefined, userId: string) {
  const raw = profile?.username?.trim();
  if (raw) return raw.startsWith("@") ? raw : `@${raw}`;
  return `@${userId.slice(0, 8)}`;
}

function initialsOf(profile: ProfileBits | undefined) {
  const n = profile?.display_name || profile?.username || "?";
  return n.replace(/^@/, "").slice(0, 2).toUpperCase();
}

function chattingLabel(count: number) {
  if (count <= 0) return "Be the first to chat";
  if (count === 1) return "1 person chatting";
  return `${count} people chatting`;
}

export function GlobalLiveChat({
  userId,
  className,
  fill,
}: {
  userId: string;
  className?: string;
  /** Fill parent height (immersive live chat page). */
  fill?: boolean;
}) {
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"gifs" | "memes">("gifs");
  const [pickerQuery, setPickerQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [emojiRow, setEmojiRow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(pickerQuery.trim()), 280);
    return () => window.clearTimeout(t);
  }, [pickerQuery]);

  const { data, isLoading } = useQuery({
    queryKey: ["global-live-chat"],
    retry: false,
    queryFn: async (): Promise<{ rows: ChatRow[]; error: string | null }> => {
      const { data: rows, error: qErr } = await supabase
        .from("global_chat_messages")
        .select("id, body, kind, media_url, created_at, user_id")
        .order("created_at", { ascending: true })
        .limit(200);

      if (qErr) {
        return { rows: [], error: errMessage(qErr) || "Could not load chat" };
      }

      const ids = [...new Set((rows ?? []).map((c) => c.user_id))];
      const profiles: Record<string, ProfileBits> = {};
      if (ids.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", ids);
        for (const p of ps ?? []) {
          profiles[p.id] = {
            display_name: p.display_name,
            username: p.username,
            avatar_url: p.avatar_url,
          };
        }
      }
      return {
        rows: (rows ?? []).map((c) => ({
          ...c,
          kind: (c.kind as ChatKind) || "text",
          profile: profiles[c.user_id],
        })),
        error: null,
      };
    },
  });

  const messages = data?.rows ?? [];
  const loadError = data?.error ?? null;
  const uniqueChatters = useMemo(
    () => new Set(messages.map((m) => m.user_id)).size,
    [messages],
  );

  const mediaQuery = useQuery({
    queryKey: ["klipy-global", pickerTab, debouncedQuery || "openpay"],
    enabled: pickerOpen,
    staleTime: 60_000,
    queryFn: () =>
      searchKlipyMedia({
        tab: pickerTab,
        query: debouncedQuery || "crypto",
        perPage: 24,
      }),
  });

  useEffect(() => {
    const channel = supabase
      .channel("global-chat")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "global_chat_messages",
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["global-live-chat"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  useEffect(() => {
    if (!mounted || messages.length === 0) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, mounted]);

  async function send(payload: {
    kind: ChatKind;
    body: string;
    media_url?: string | null;
  }) {
    const text = payload.body.trim();
    if (!text && !payload.media_url) return;
    setBusy(true);
    try {
      const { error: insertErr } = await supabase.from("global_chat_messages").insert({
        user_id: userId,
        kind: payload.kind,
        body: text || payload.kind,
        media_url: payload.media_url ?? null,
      });
      if (insertErr) throw insertErr;
      setBody("");
      setPickerOpen(false);
      setEmojiRow(false);
      await qc.invalidateQueries({ queryKey: ["global-live-chat"] });
    } catch (err) {
      const msg = errMessage(err) || "Could not send";
      if (isMissingTable(msg)) {
        toast.error("Global chat needs a DB migration — run global_chat_messages on Supabase");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  function sendMedia(item: KlipyMediaItem) {
    void send({
      kind: "gif",
      body: item.title || item.kind.toUpperCase(),
      media_url: item.url,
    });
  }

  const missingTable = Boolean(loadError && isMissingTable(loadError));

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border/40 bg-background",
        fill ? "h-full flex-1" : "h-[min(40rem,calc(100dvh-8rem))]",
        className,
      )}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-border/40 px-4 py-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15">
          <img src={OUSD_LOGO_URL} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">OpenPay Live</span>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {chattingLabel(uniqueChatters)} · global community
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading chat…</p>
        ) : missingTable ? (
          <p className="text-sm text-muted-foreground">
            Chat is unavailable until the global_chat_messages migration is applied.
          </p>
        ) : loadError ? (
          <p className="text-sm text-muted-foreground">Could not load chat. Try again later.</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Welcome to OpenPay Live — say hi with your name, username, and profile photo.
          </p>
        ) : (
          messages.map((m) => {
            const name = displayNameOf(m.profile, m.user_id);
            const handle = usernameOf(m.profile, m.user_id);
            return (
              <div key={m.id} className="flex gap-3">
                <Link
                  to="/opentoken/creator/$userId"
                  params={{ userId: m.user_id }}
                  className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-xs font-bold"
                >
                  {m.profile?.avatar_url ? (
                    <img
                      src={m.profile.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initialsOf(m.profile)
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <Link
                      to="/opentoken/creator/$userId"
                      params={{ userId: m.user_id }}
                      className="truncate text-sm font-semibold text-foreground hover:text-primary"
                    >
                      {name}
                    </Link>
                    <Link
                      to="/opentoken/creator/$userId"
                      params={{ userId: m.user_id }}
                      className="truncate text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      {handle}
                    </Link>
                  </div>
                  {m.kind === "emoji" || m.kind === "sticker" ? (
                    <p className="mt-1 text-3xl leading-none">{m.body}</p>
                  ) : m.media_url ? (
                    <div className="mt-1.5 space-y-1">
                      {m.body && m.kind === "text" ? (
                        <p className="whitespace-pre-wrap text-[15px] leading-snug">{m.body}</p>
                      ) : null}
                      <img
                        src={m.media_url}
                        alt=""
                        className="max-h-52 max-w-[min(100%,18rem)] rounded-2xl object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-snug text-foreground">
                      {m.body}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {emojiRow && !pickerOpen ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-t border-border/40 px-2 py-2">
          {EMOJI_QUICK.map((e) => (
            <button
              key={e}
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl hover:bg-muted press"
              onClick={() => void send({ kind: "emoji", body: e })}
              disabled={busy}
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}

      {pickerOpen ? (
        <div className="relative flex max-h-[48%] min-h-56 shrink-0 flex-col rounded-t-3xl border-t border-border/50 bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.35)]">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/35" />
          <div className="flex items-center gap-2 px-3 pb-2 pt-3">
            <div className="flex flex-1 items-center gap-1 rounded-full bg-muted/70 p-0.5">
              {(["gifs", "memes"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPickerTab(tab)}
                  className={cn(
                    "flex-1 rounded-full px-3 py-1.5 text-sm font-semibold capitalize press",
                    pickerTab === tab
                      ? "bg-muted text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {tab === "gifs" ? "GIFs" : "Memes"}
                </button>
              ))}
            </div>
            <span className="hidden text-[10px] font-medium text-muted-foreground sm:inline">
              Powered by KLIPY
            </span>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              onClick={() => setPickerOpen(false)}
              aria-label="Close media picker"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative px-3 pb-2">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Search KLIPY"
              className="h-10 rounded-2xl border-0 bg-muted pl-9 text-sm"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {mediaQuery.isLoading ? (
              <div className="grid place-items-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {(mediaQuery.data?.items ?? []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    onClick={() => sendMedia(item)}
                    className="relative overflow-hidden rounded-xl bg-muted press"
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.title}
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                    {item.kind === "gif" ? (
                      <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                        GIF
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex shrink-0 items-center gap-2 border-t border-border/40 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <div className="relative flex min-w-0 flex-1 items-center">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 500))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send({ kind: "text", body });
              }
            }}
            placeholder="Write message"
            className="h-11 w-full rounded-full border-0 bg-muted py-2 pl-4 pr-11 text-[15px] outline-none placeholder:text-muted-foreground"
            disabled={busy || missingTable}
          />
          <button
            type="button"
            className={cn(
              "absolute right-1.5 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground",
              (pickerOpen || emojiRow) && "text-foreground",
            )}
            onClick={() => {
              if (pickerOpen) {
                setPickerOpen(false);
                return;
              }
              setEmojiRow(false);
              setPickerOpen(true);
              setPickerQuery("crypto");
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setPickerOpen(false);
              setEmojiRow((v) => !v);
            }}
            aria-label="GIFs and memes"
          >
            <Smile className="h-5 w-5" />
          </button>
        </div>
        <Button
          type="button"
          className="h-11 shrink-0 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground"
          disabled={busy || !body.trim()}
          onClick={() => void send({ kind: "text", body })}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
        </Button>
      </div>
    </div>
  );
}
