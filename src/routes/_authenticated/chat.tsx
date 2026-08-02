import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Search, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/wallet/PageHeader";
import { GlobalLiveChat } from "@/components/wallet/GlobalLiveChat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TokenAvatar } from "@/components/wallet/TokenAvatar";
import { OusdIcon } from "@/components/ousd-icon";
import { cn } from "@/lib/utils";
import {
  MAJOR_TOKEN_IDS,
  MAJOR_TOKENS,
  MAJOR_SYMBOLS,
  fetchMajorMarkets,
  majorMarketById,
  type MajorTokenId,
} from "@/lib/major-tokens";
import { formatNumber, formatPct } from "@/lib/wallet-utils";
import { OUSD_LOGO_URL } from "@/lib/token-logos";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Live Chat — OpenPay Pro" },
      {
        name: "description",
        content:
          "Global OpenPay chat plus a separate live room for every token — OUSD, all majors, and OpenTokens.",
      },
    ],
  }),
  component: LiveChatHubPage,
});

type HubTab = "rooms" | "global";

type OpenTokenRoom = {
  id: string;
  name: string;
  symbol: string;
  logo_url: string | null;
  is_verified: boolean | null;
  price_usd?: number | null;
  change_24h?: number | null;
  is_hidden?: boolean | null;
};

/** Featured trade majors first, then every other major in catalog order. */
const FEATURED_MAJOR_IDS: MajorTokenId[] = ["btc", "eth", "sol", "pi"];

function orderedMajorRooms(): MajorTokenId[] {
  const featured = FEATURED_MAJOR_IDS.filter((id) => MAJOR_TOKEN_IDS.includes(id));
  const rest = MAJOR_TOKEN_IDS.filter((id) => !FEATURED_MAJOR_IDS.includes(id));
  return [...featured, ...rest];
}

function matchesQuery(q: string, name: string, symbol: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  return (
    name.toLowerCase().includes(needle) ||
    symbol.toLowerCase().includes(needle)
  );
}

function formatListPrice(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1000) return `$${formatNumber(n, 2)}`;
  if (n >= 1) return `$${formatNumber(n, n >= 100 ? 2 : 4)}`;
  return `$${formatNumber(n, n < 0.01 ? 6 : 4)}`;
}

function LiveChatHubPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [tab, setTab] = useState<HubTab>("rooms");
  const [query, setQuery] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("display_name, username, avatar_url")
          .eq("id", user.id)
          .maybeSingle()
      ).data,
  });

  const { data: majorMarkets } = useQuery({
    queryKey: ["major-markets"],
    staleTime: 20_000,
    refetchInterval: 30_000,
    queryFn: () => fetchMajorMarkets(),
  });

  const { data: openTokens = [] } = useQuery<OpenTokenRoom[]>({
    queryKey: ["ot-tokens", "chat-rooms-all"],
    staleTime: 60_000,
    queryFn: async (): Promise<OpenTokenRoom[]> => {
      const { data, error } = await supabase
        .from("tokens")
        .select("id, name, symbol, logo_url, is_verified, is_hidden, price_usd, change_24h")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        const { data: fallback } = await supabase
          .from("tokens")
          .select("id, name, symbol, logo_url, is_verified, price_usd, change_24h")
          .order("created_at", { ascending: false })
          .limit(500);
        return (fallback ?? []) as OpenTokenRoom[];
      }
      return ((data ?? []) as OpenTokenRoom[]).filter((t: OpenTokenRoom) => {
        const sym = String(t.symbol ?? "").toUpperCase();
        const name = String(t.name ?? "").toUpperCase();
        return !MAJOR_SYMBOLS.has(sym) && !MAJOR_SYMBOLS.has(name);
      });
    },
  });

  const majorRooms = useMemo(() => orderedMajorRooms(), []);

  const filteredMajors = useMemo(
    () =>
      majorRooms.filter((id) => {
        const def = MAJOR_TOKENS[id];
        return matchesQuery(query, def.name, def.symbol);
      }),
    [majorRooms, query],
  );

  const showOusd = matchesQuery(query, "OpenUSD", "OUSD");

  const filteredOpenTokens = useMemo(
    () =>
      openTokens.filter((t: OpenTokenRoom) =>
        matchesQuery(query, String(t.name ?? ""), String(t.symbol ?? "")),
      ),
    [openTokens, query],
  );

  const roomCount =
    (showOusd ? 1 : 0) + filteredMajors.length + filteredOpenTokens.length;

  const displayName = profile?.display_name?.trim() || "You";
  const username = profile?.username?.trim()
    ? profile.username.startsWith("@")
      ? profile.username
      : `@${profile.username}`
    : null;
  const initials = displayName.slice(0, 1).toUpperCase() || "U";

  function openRoom(tokenId: string) {
    void navigate({
      to: "/asset/$tokenId/chat",
      params: { tokenId },
    });
  }

  return (
    <div className="ot-phantom flex h-dvh min-h-0 flex-col bg-background">
      <PageHeader
        title="Live Chat"
        backTo="/dashboard"
        className="mx-0 mb-0 shrink-0 rounded-none border-b border-border/40 px-3"
      />

      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:max-w-none lg:px-4">
        <section className="mb-3 flex shrink-0 items-center gap-3 rounded-3xl bg-card p-3.5">
          <Avatar className="h-12 w-12 border border-border/60">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
            <AvatarFallback className="bg-primary/15 text-sm font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
              <p className="truncate text-sm font-semibold">{displayName}</p>
            </div>
            {username ? (
              <p className="truncate text-xs text-muted-foreground">{username}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Add a username in{" "}
                <Link
                  to="/settings"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Settings
                </Link>
                .
              </p>
            )}
          </div>
        </section>

        <div className="mb-3 flex shrink-0 gap-1 rounded-2xl bg-muted/50 p-1">
          {(
            [
              ["rooms", "Token rooms"],
              ["global", "Global"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 rounded-xl py-2 text-xs font-bold press",
                tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "global" ? (
          <GlobalLiveChat userId={user.id} fill className="min-h-0" />
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
            <p className="px-0.5 text-xs leading-relaxed text-muted-foreground">
              Each token opens the same Live Chat as Global — with that token’s name, logo, and
              live price. Messages stay in that room only.
            </p>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search all token rooms"
                className="h-11 w-full rounded-2xl border border-border/60 bg-card/80 pl-10 pr-3 text-sm outline-none ring-primary/30 placeholder:text-muted-foreground focus:ring-2"
              />
            </div>

            <button
              type="button"
              onClick={() => setTab("global")}
              className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-3.5 py-3 press hover:bg-muted/40"
            >
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-primary/15">
                <img src={OUSD_LOGO_URL} alt="" className="h-full w-full object-cover" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="flex items-center gap-2">
                  <span className="block text-sm font-bold">OpenPay Live</span>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                </span>
                <span className="block text-xs text-muted-foreground">
                  Global community · all topics
                </span>
              </span>
              <Users className="h-4 w-4 text-primary" />
            </button>

            <section>
              <h2 className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                All tokens · {roomCount} room{roomCount === 1 ? "" : "s"}
              </h2>
              {!showOusd && filteredMajors.length === 0 && filteredOpenTokens.length === 0 ? (
                <p className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  No rooms match “{query.trim()}”.
                </p>
              ) : (
                <ul className="overflow-hidden rounded-2xl border border-border/60 bg-card/60">
                  {showOusd ? (
                    <li>
                      <button
                        type="button"
                        onClick={() => openRoom("ousd")}
                        className="flex w-full items-center gap-3 border-b border-border/40 px-3.5 py-3 press hover:bg-muted/40"
                      >
                        <OusdIcon className="h-11 w-11" />
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block text-sm font-bold">OpenUSD</span>
                          <span className="block text-xs text-muted-foreground">
                            OUSD · $1.00 · 0.00%
                          </span>
                        </span>
                        <MessageCircle className="h-4 w-4 text-primary" />
                      </button>
                    </li>
                  ) : null}
                  {filteredMajors.map((id) => {
                    const def = MAJOR_TOKENS[id];
                    const m = majorMarketById(majorMarkets, id);
                    const price = Number(m.price ?? 0);
                    const change = Number(m.change24h ?? 0);
                    const up = change > 0;
                    const down = change < 0;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => openRoom(id)}
                          className="flex w-full items-center gap-3 border-b border-border/40 px-3.5 py-3 press hover:bg-muted/40"
                        >
                          <TokenAvatar
                            logoUrl={def.logoUrl}
                            name={def.name}
                            symbol={def.symbol}
                            verified
                          />
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-sm font-bold">{def.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {def.symbol} · {formatListPrice(price)}{" "}
                              <span
                                className={cn(
                                  "font-semibold",
                                  up && "text-emerald-500",
                                  down && "text-rose-500",
                                )}
                              >
                                {formatPct(change)}
                              </span>
                            </span>
                          </span>
                          <MessageCircle className="h-4 w-4 text-primary" />
                        </button>
                      </li>
                    );
                  })}
                  {filteredOpenTokens.map((t: OpenTokenRoom) => {
                    const price = Number(t.price_usd ?? 0);
                    const change = Number(t.change_24h ?? 0);
                    const up = change > 0;
                    const down = change < 0;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => openRoom(t.id)}
                          className="flex w-full items-center gap-3 border-b border-border/40 px-3.5 py-3 last:border-b-0 press hover:bg-muted/40"
                        >
                          <TokenAvatar
                            logoUrl={t.logo_url}
                            name={t.name}
                            symbol={t.symbol}
                            verified={Boolean(t.is_verified)}
                          />
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-sm font-bold">{t.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {t.symbol} · {formatListPrice(price)}{" "}
                              <span
                                className={cn(
                                  "font-semibold",
                                  up && "text-emerald-500",
                                  down && "text-rose-500",
                                )}
                              >
                                {formatPct(change)}
                              </span>
                            </span>
                          </span>
                          <MessageCircle className="h-4 w-4 text-primary" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
