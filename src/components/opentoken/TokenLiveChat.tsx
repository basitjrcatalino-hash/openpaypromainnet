import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ImageIcon, Loader2, Search, Smile, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatNumber, formatPct } from "@/lib/wallet-utils";
import { searchKlipyMedia, type KlipyMediaItem } from "@/lib/klipy";

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

type TradeFeedRow = {
  id: string;
  type: "trade";
  created_at: string;
  user_id: string;
  side: "buy" | "sell";
  usdAmount: number;
  profile?: ProfileBits;
};

type MessageFeedRow = ChatRow & { type: "message" };

type FeedItem = MessageFeedRow | TradeFeedRow;

export type TokenLiveChatProps = {
  tokenId: string;
  /**
   * When set, messages use `asset_chat_messages.room_id` (majors / OUSD / any string).
   * When omitted, uses OpenToken `ot_token_chat_messages` keyed by UUID `tokenId`.
   */
  roomId?: string;
  userId: string;
  name: string;
  symbol: string;
  logoUrl?: string | null;
  priceUsd: number;
  change24h: number;
  /** Absolute 24h move in USD (Phantom shows +$2 under %). */
  changeAbs?: number | null;
  /** Opens trade / buy sheet (Phantom "Trade" CTA). */
  onTrade?: () => void;
  /** When set, shows close (X) — Phantom dismiss. */
  onClose?: () => void;
  /** Full-screen portal like Phantom asset chat. Default: embedded panel. */
  variant?: "panel" | "overlay" | "page";
  className?: string;
};

const EMOJI_QUICK = ["🚀", "💎", "🔥", "📈", "🐸", "💰", "⚡", "🌙", "🫡", "👑", "😂", "💀"];

/** Phantom chat lavender Trade CTA */
const PHANTOM_TRADE_BTN = "bg-[#ABA3FF] text-black hover:bg-[#B8B0FF] active:bg-[#9D94F5]";

function errMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message ?? "");
  }
  return String(err);
}

function isMissingChatTable(message: string) {
  return /relation|ot_token_chat_messages|asset_chat_messages|schema cache|does not exist|Could not find the table/i.test(
    message,
  );
}

function handleLabel(profile: ProfileBits | undefined, userId: string) {
  const raw = profile?.username || profile?.display_name;
  if (raw) return raw.startsWith("@") ? raw : `@${raw}`;
  return `@${userId.slice(0, 6)}`;
}

function chattingLabel(count: number) {
  if (count <= 0) return "Be the first to chat";
  if (count === 1) return "1 person chatting";
  return `${count} people chatting`;
}

function isUuidTokenId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

function formatTradeUsd(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (abs >= 1) {
    return abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPriceHeader(n: number) {
  if (!(n > 0)) return "—";
  if (n >= 1000) return `$${formatNumber(n, 2)}`;
  if (n >= 1) return `$${formatNumber(n, n >= 100 ? 2 : 4)}`;
  return `$${formatNumber(n, n < 0.01 ? 6 : 4)}`;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startToday - startMsg) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function loadProfiles(ids: string[]): Promise<Record<string, ProfileBits>> {
  const profiles: Record<string, ProfileBits> = {};
  if (!ids.length) return profiles;
  const { data: ps } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .in("id", ids);
  for (const p of ps ?? []) profiles[p.id] = p;
  return profiles;
}

function AvatarBubble({
  profile,
  userId,
  className,
}: {
  profile?: ProfileBits;
  userId: string;
  className?: string;
}) {
  const letter = handleLabel(profile, userId).replace("@", "").slice(0, 1).toUpperCase();
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#2A2A2A] text-[11px] font-bold text-white",
        className,
      )}
    >
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        letter
      )}
    </div>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-white/10" />
      <span className="shrink-0 text-[11px] font-medium text-white/40">{label}</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

export function TokenLiveChat({
  tokenId,
  roomId,
  userId,
  name,
  symbol,
  logoUrl,
  priceUsd,
  change24h,
  changeAbs,
  onTrade,
  onClose,
  variant = "panel",
  className,
}: TokenLiveChatProps) {
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

  /** Asset rooms (majors/OUSD) use text room_id; OpenToken UUID keeps legacy table unless roomId set. */
  const assetRoom = (roomId ?? (!isUuidTokenId(tokenId) ? tokenId : null))?.toLowerCase() ?? null;
  const chatKey = assetRoom ?? tokenId;
  const useAssetTable = Boolean(assetRoom);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(pickerQuery.trim()), 280);
    return () => window.clearTimeout(t);
  }, [pickerQuery]);

  const { data, isLoading } = useQuery({
    queryKey: ["ot-live-chat", chatKey, useAssetTable ? "asset" : "ot"],
    enabled: Boolean(chatKey),
    retry: false,
    queryFn: async (): Promise<{ rows: ChatRow[]; error: string | null }> => {
      if (useAssetTable && assetRoom) {
        const { data: rows, error: qErr } = await (supabase as any)
          .from("asset_chat_messages")
          .select("id, body, kind, media_url, created_at, user_id")
          .eq("room_id", assetRoom)
          .order("created_at", { ascending: true })
          .limit(150);

        if (qErr) {
          return { rows: [], error: errMessage(qErr) || "Could not load chat" };
        }

        const ids = [
          ...new Set((rows ?? []).map((c: { user_id: string }) => String(c.user_id))),
        ] as string[];
        const profiles = await loadProfiles(ids);
        return {
          rows: (rows ?? []).map((c: ChatRow & { kind?: string }) => ({
            ...c,
            kind: (c.kind as ChatKind) || "text",
            profile: profiles[c.user_id],
          })),
          error: null,
        };
      }

      const { data: rows, error: qErr } = await supabase
        .from("ot_token_chat_messages")
        .select("id, body, kind, media_url, created_at, user_id")
        .eq("token_id", tokenId)
        .order("created_at", { ascending: true })
        .limit(150);

      if (qErr) {
        return { rows: [], error: errMessage(qErr) || "Could not load chat" };
      }

      const ids = [...new Set((rows ?? []).map((c) => c.user_id))];
      const profiles = await loadProfiles(ids);
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

  const { data: trades = [] } = useQuery({
    queryKey: ["ot-live-chat-trades", tokenId],
    enabled: Boolean(tokenId) && isUuidTokenId(tokenId) && !useAssetTable,
    queryFn: async (): Promise<TradeFeedRow[]> => {
      const { data: rows, error } = await supabase
        .from("ot_trades")
        .select("id, created_at, user_id, side, pi_amount")
        .eq("token_id", tokenId)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error || !rows?.length) return [];
      const profiles = await loadProfiles([...new Set(rows.map((r) => r.user_id))]);
      return rows.map((r) => ({
        id: `trade-${r.id}`,
        type: "trade" as const,
        created_at: r.created_at,
        user_id: r.user_id,
        side: r.side === "sell" ? ("sell" as const) : ("buy" as const),
        usdAmount: Math.abs(Number(r.pi_amount ?? 0)),
        profile: profiles[r.user_id],
      }));
    },
  });

  const messages = data?.rows ?? [];
  const loadError = data?.error ?? null;

  const feed = useMemo((): FeedItem[] => {
    const msgItems: MessageFeedRow[] = messages.map((m) => ({ ...m, type: "message" }));
    const merged = [...msgItems, ...trades];
    merged.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    return merged.slice(-160);
  }, [messages, trades]);

  const uniqueChatters = useMemo(() => {
    const ids = new Set<string>();
    for (const m of messages) ids.add(m.user_id);
    for (const t of trades) ids.add(t.user_id);
    return ids.size;
  }, [messages, trades]);

  const up = change24h >= 0;
  const absMove =
    changeAbs != null && Number.isFinite(changeAbs)
      ? changeAbs
      : priceUsd > 0 && Number.isFinite(change24h)
        ? (priceUsd * change24h) / 100
        : null;

  const mediaQuery = useQuery({
    queryKey: ["klipy", pickerTab, debouncedQuery || symbol],
    enabled: pickerOpen,
    staleTime: 60_000,
    queryFn: () =>
      searchKlipyMedia({
        tab: pickerTab,
        query: debouncedQuery || symbol || name || "crypto",
        perPage: 24,
      }),
  });

  useEffect(() => {
    if (!chatKey) return;
    if (useAssetTable && assetRoom) {
      const channel = supabase
        .channel(`asset-chat-${assetRoom}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "asset_chat_messages",
            filter: `room_id=eq.${assetRoom}`,
          },
          () => {
            void qc.invalidateQueries({ queryKey: ["ot-live-chat", chatKey] });
          },
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    }

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
          void qc.invalidateQueries({ queryKey: ["ot-live-chat", chatKey] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ot_trades",
          filter: `token_id=eq.${tokenId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["ot-live-chat-trades", tokenId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatKey, tokenId, useAssetTable, assetRoom, qc]);

  useEffect(() => {
    if (!mounted || feed.length === 0) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [feed.length, mounted]);

  async function send(payload: {
    kind: ChatKind;
    body: string;
    media_url?: string | null;
  }) {
    const text = payload.body.trim();
    if (!text && !payload.media_url) return;
    setBusy(true);
    try {
      if (useAssetTable && assetRoom) {
        const { error: insertErr } = await (supabase as any).from("asset_chat_messages").insert({
          room_id: assetRoom,
          user_id: userId,
          kind: payload.kind,
          body: text || payload.kind,
          media_url: payload.media_url ?? null,
        });
        if (insertErr) throw insertErr;
      } else {
        const { error: insertErr } = await supabase.from("ot_token_chat_messages").insert({
          token_id: tokenId,
          user_id: userId,
          kind: payload.kind,
          body: text || payload.kind,
          media_url: payload.media_url ?? null,
        });
        if (insertErr) throw insertErr;
      }
      setBody("");
      setPickerOpen(false);
      setEmojiRow(false);
      await qc.invalidateQueries({ queryKey: ["ot-live-chat", chatKey] });
    } catch (err) {
      const msg = errMessage(err) || "Could not send";
      if (isMissingChatTable(msg)) {
        toast.error("Live chat needs a DB migration — apply asset_chat_messages on Supabase");
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

  const missingTable = Boolean(loadError && isMissingChatTable(loadError));

  let lastDay: string | null = null;
  const feedNodes: ReactNode[] = [];
  for (const item of feed) {
    const dk = dayKey(item.created_at);
    if (dk !== lastDay) {
      lastDay = dk;
      feedNodes.push(<DateSeparator key={`day-${dk}`} label={dayLabel(item.created_at)} />);
    }
    if (item.type === "trade") {
      const buy = item.side === "buy";
      feedNodes.push(
        <div
          key={item.id}
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-2.5 py-2",
            buy ? "bg-[#0D2A1A]" : "bg-[#2A1212]",
          )}
        >
          <AvatarBubble profile={item.profile} userId={item.user_id} className="h-7 w-7" />
          <Link
            to="/opentoken/creator/$userId"
            params={{ userId: item.user_id }}
            className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/90"
          >
            {handleLabel(item.profile, item.user_id)}
          </Link>
          <span
            className={cn(
              "shrink-0 text-[13px] font-semibold tabular-nums",
              buy ? "text-[#14F195]" : "text-[#FF6B6B]",
            )}
          >
            {buy ? "+" : "-"}${formatTradeUsd(item.usdAmount)}
          </span>
        </div>,
      );
      continue;
    }

    const m = item;
    feedNodes.push(
      <div key={m.id} className="flex gap-2.5 px-0.5">
        <AvatarBubble profile={m.profile} userId={m.user_id} className="mt-0.5 h-8 w-8" />
        <div className="min-w-0 flex-1">
          <Link
            to="/opentoken/creator/$userId"
            params={{ userId: m.user_id }}
            className="text-[13px] font-medium leading-none text-white/55"
          >
            {handleLabel(m.profile, m.user_id)}
          </Link>
          {m.kind === "emoji" || m.kind === "sticker" ? (
            <p className="mt-1 text-3xl leading-none">{m.body}</p>
          ) : m.media_url ? (
            <div className="mt-1.5 space-y-1">
              {m.body && m.kind === "text" ? (
                <p className="whitespace-pre-wrap text-[15px] leading-snug text-white">{m.body}</p>
              ) : null}
              <img
                src={m.media_url}
                alt=""
                className="max-h-52 max-w-[min(100%,18rem)] rounded-2xl object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-snug text-white">{m.body}</p>
          )}
        </div>
      </div>,
    );
  }

  const shell = (
    <div
      className={cn(
        "flex flex-col bg-black text-white",
        variant === "overlay" || variant === "page"
          ? "h-full min-h-0"
          : "h-[min(36rem,78vh)] overflow-hidden rounded-3xl border border-white/10",
        className,
      )}
    >
      {/* Phantom header — logo + name + live price */}
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/80 press hover:bg-white/10 hover:text-white"
            aria-label="Close chat"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        ) : (
          <span className="w-9 shrink-0" aria-hidden />
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#1C1C1C]">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-white">{symbol.slice(0, 2)}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight text-white">{name}</div>
            <div className="truncate text-[12px] leading-tight text-white/45">
              {chattingLabel(uniqueChatters)}
            </div>
          </div>
        </div>
        <div className="shrink-0 pr-1 text-right">
          <div className="text-[15px] font-semibold tabular-nums leading-tight text-white">
            {formatPriceHeader(priceUsd)}
          </div>
          <div
            className={cn(
              "text-[12px] font-semibold tabular-nums leading-tight",
              up ? "text-[#14F195]" : "text-[#FF6B6B]",
            )}
          >
            {formatPct(change24h)}
            {absMove != null && Math.abs(absMove) >= 0.005 ? (
              <span className="ml-1.5">
                {absMove >= 0 ? "+" : "−"}$
                {formatNumber(Math.abs(absMove), Math.abs(absMove) >= 1 ? 2 : 2)}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* Message + trade feed */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-2">
        {isLoading ? (
          <p className="px-1 py-6 text-sm text-white/40">Loading chat…</p>
        ) : missingTable ? (
          <p className="px-1 py-6 text-sm text-white/40">
            Chat is unavailable until the live-chat migration is applied on Supabase (
            <code className="text-white/55">asset_chat_messages</code>).
          </p>
        ) : loadError ? (
          <p className="px-1 py-6 text-sm text-white/40">Could not load chat. Try again later.</p>
        ) : feed.length === 0 ? (
          <p className="px-1 py-6 text-sm text-white/40">
            Be the first in the {symbol} room — say something.
          </p>
        ) : (
          feedNodes
        )}
        <div ref={bottomRef} />
      </div>

      {emojiRow && !pickerOpen ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto px-2 py-2">
          {EMOJI_QUICK.map((e) => (
            <button
              key={e}
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl hover:bg-white/10 press"
              onClick={() => void send({ kind: "emoji", body: e })}
              disabled={busy}
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}

      {pickerOpen ? (
        <div className="relative flex max-h-[48%] min-h-56 shrink-0 flex-col rounded-t-3xl border-t border-white/10 bg-[#121212] shadow-[0_-8px_40px_rgba(0,0,0,0.55)]">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/25" />
          <div className="flex items-center gap-2 px-3 pb-2 pt-3">
            <div className="flex flex-1 items-center gap-1 rounded-full bg-white/10 p-0.5">
              {(["gifs", "memes"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPickerTab(tab)}
                  className={cn(
                    "flex-1 rounded-full px-3 py-1.5 text-sm font-semibold capitalize press",
                    pickerTab === tab ? "bg-white/15 text-white" : "text-white/45",
                  )}
                >
                  {tab === "gifs" ? "GIFs" : "Memes"}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
              onClick={() => setPickerOpen(false)}
              aria-label="Close media picker"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="px-3 pb-2 text-[10px] font-medium text-white/35">Powered by KLIPY</p>
          <div className="relative px-3 pb-2">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <Input
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Search KLIPY"
              className="h-10 rounded-2xl border-0 bg-white/10 pl-9 text-sm text-white placeholder:text-white/35 focus-visible:ring-white/20"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {mediaQuery.isLoading ? (
              <div className="grid place-items-center py-10 text-white/40">
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
                    className="relative overflow-hidden rounded-xl bg-white/5 press"
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
            {!mediaQuery.isLoading && !(mediaQuery.data?.items?.length) ? (
              <p className="py-8 text-center text-sm text-white/40">No results</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Composer — Write message + smile + Trade (Phantom) */}
      <div className="flex shrink-0 items-center gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
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
            className="h-12 w-full rounded-full border-0 bg-[#1C1C1C] py-2 pl-4 pr-11 text-[15px] text-white outline-none placeholder:text-white/35"
            disabled={busy || missingTable}
          />
          <button
            type="button"
            className={cn(
              "absolute right-1.5 grid h-9 w-9 place-items-center rounded-full text-white/45 hover:text-white",
              (pickerOpen || emojiRow) && "text-white",
            )}
            onClick={() => {
              if (body.trim()) {
                void send({ kind: "text", body });
                return;
              }
              if (pickerOpen) {
                setPickerOpen(false);
                return;
              }
              setEmojiRow((v) => !v);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setEmojiRow(false);
              setPickerOpen(true);
              setPickerQuery(symbol || name);
            }}
            aria-label={body.trim() ? "Send message" : "Emoji and GIFs"}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smile className="h-5 w-5" />}
          </button>
        </div>
        <button
          type="button"
          className={cn(
            "h-12 shrink-0 rounded-full px-5 text-[15px] font-bold press disabled:opacity-50",
            PHANTOM_TRADE_BTN,
          )}
          onClick={() => onTrade?.()}
          disabled={!onTrade}
        >
          Trade
        </button>
      </div>
    </div>
  );

  if (variant === "overlay") {
    if (!mounted) return null;
    return createPortal(
      <div className="fixed inset-0 z-70 flex flex-col bg-black">{shell}</div>,
      document.body,
    );
  }

  return shell;
}

/** Alias icon export for headers that want an image affordance. */
export function TokenLiveChatIcon(props: { className?: string }) {
  return <ImageIcon className={props.className} />;
}
