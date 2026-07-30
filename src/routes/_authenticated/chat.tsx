import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/wallet/PageHeader";
import { GlobalLiveChat } from "@/components/wallet/GlobalLiveChat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Live Chat — OpenPay Pro" },
      {
        name: "description",
        content: "Global OpenPay community live chat with profiles, usernames, and avatars.",
      },
    ],
  }),
  component: GlobalChatPage,
});

function GlobalChatPage() {
  const { user } = Route.useRouteContext();

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
    <div className="mx-auto max-w-2xl space-y-4 pb-8 animate-page-in">
      <PageHeader title="Live Chat" subtitle="Global OpenPay community" />

      <section className="flex items-center gap-3 rounded-3xl bg-card p-4">
        <Avatar className="h-14 w-14 border border-border/60">
          {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
          <AvatarFallback className="bg-primary/15 text-sm font-bold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
            <p className="truncate text-base font-semibold">{displayName}</p>
          </div>
          {username ? (
            <p className="truncate text-sm text-muted-foreground">{username}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add a username in{" "}
              <Link to="/settings" className="font-medium text-primary underline-offset-2 hover:underline">
                Settings
              </Link>{" "}
              so others can find you.
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Your name, username, and photo show on every message.
          </p>
        </div>
      </section>

      <GlobalLiveChat userId={user.id} />
    </div>
  );
}
