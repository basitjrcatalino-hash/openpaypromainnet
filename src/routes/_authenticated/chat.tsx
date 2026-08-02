import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, MessageCircle, Users } from "lucide-react";

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
  type MajorTokenId,
} from "@/lib/major-tokens";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Live Chat — OpenPay Pro" },
      {
        name: "description",
        content:
          "Global OpenPay chat plus a separate live room for every token — OUSD, majors, and OpenTokens.",
      },
    ],
  }),
  component: LiveChatHubPage,
});

type HubTab = "rooms" | "global";

/** Pin order: OUSD then PI then remaining majors by catalog order. */
function orderedMajorRooms(): MajorTokenId[] {
  const rest = MAJOR_TOKEN_IDS.filter((id) => id !== "pi");
  return ["pi", ...rest];
}

function LiveChatHubPage() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<HubTab>("rooms");

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

  const { data: openTokens = [] } = useQuery({
    queryKey: ["ot-tokens", "chat-rooms"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("id, name, symbol, logo_url, is_verified, is_hidden")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) {
        const { data: fallback } = await supabase
          .from("tokens")
          .select("id, name, symbol, logo_url, is_verified")
          .order("created_at", { ascending: false })
          .limit(80);
        return fallback ?? [];
      }
      return (data ?? []).filter((t) => {
        const sym = String(t.symbol ?? "").toUpperCase();
        const name = String(t.name ?? "").toUpperCase();
        return !MAJOR_SYMBOLS.has(sym) && !MAJOR_SYMBOLS.has(name);
      });
    },
  });

  const majorRooms = useMemo(() => orderedMajorRooms(), []);

  const displayName = profile?.display_name?.trim() || "You";
  const username = profile?.username?.trim()
    ? profile.username.startsWith("@")
      ? profile.username
      : `@${profile.username}`
    : null;
  const initials = (profile?.display_name || profile?.username || "U")
    .replace(/^@/, "")
    .slice(0, 2)
    .toUpperCase();

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
              Each token has its own live chat room — messages stay in that room only.
            </p>

            <button
              type="button"
              onClick={() => setTab("global")}
              className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-3.5 py-3 press hover:bg-muted/40"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-primary">
                <Users className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-bold">OpenPay Global</span>
                <span className="block text-xs text-muted-foreground">
                  Community room · all topics
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <section>
              <h2 className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                OpenPay · Majors
              </h2>
              <ul className="overflow-hidden rounded-2xl border border-border/60 bg-card/60">
                <li>
                  <Link
                    to="/asset/$tokenId/chat"
                    params={{ tokenId: "ousd" }}
                    className="flex items-center gap-3 border-b border-border/40 px-3.5 py-3 press hover:bg-muted/40"
                  >
                    <OusdIcon className="h-11 w-11" />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-bold">OpenUSD</span>
                      <span className="block text-xs text-muted-foreground">
                        OUSD room · separated
                      </span>
                    </span>
                    <MessageCircle className="h-4 w-4 text-primary" />
                  </Link>
                </li>
                {majorRooms.map((id) => {
                  const def = MAJOR_TOKENS[id];
                  return (
                    <li key={id}>
                      <Link
                        to="/asset/$tokenId/chat"
                        params={{ tokenId: id }}
                        className="flex items-center gap-3 border-b border-border/40 px-3.5 py-3 last:border-b-0 press hover:bg-muted/40"
                      >
                        <TokenAvatar
                          logoUrl={def.logoUrl}
                          name={def.name}
                          symbol={def.symbol}
                          verified
                        />
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-sm font-bold">{def.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {def.symbol} room · separated
                          </span>
                        </span>
                        <MessageCircle className="h-4 w-4 text-primary" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section>
              <h2 className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                OpenTokens
              </h2>
              {!openTokens.length ? (
                <p className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  No OpenTokens yet. Launch one to open its chat room.
                </p>
              ) : (
                <ul className="overflow-hidden rounded-2xl border border-border/60 bg-card/60">
                  {openTokens.map((t) => (
                    <li key={t.id}>
                      <Link
                        to="/opentoken/$tokenId/chat"
                        params={{ tokenId: t.id }}
                        className="flex items-center gap-3 border-b border-border/40 px-3.5 py-3 last:border-b-0 press hover:bg-muted/40"
                      >
                        <TokenAvatar
                          logoUrl={t.logo_url}
                          name={t.name}
                          symbol={t.symbol}
                          verified={Boolean(t.is_verified)}
                        />
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-sm font-bold">{t.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {t.symbol} room · separated
                          </span>
                        </span>
                        <MessageCircle className="h-4 w-4 text-primary" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
