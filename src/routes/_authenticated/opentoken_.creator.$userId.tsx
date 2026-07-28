/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatUSD } from "@/lib/wallet-utils";
import { TokenCard } from "@/components/opentoken";

export const Route = createFileRoute("/_authenticated/opentoken_/creator/$userId")({
  head: () => ({ meta: [{ title: "Creator — OpenToken" }] }),
  component: CreatorProfilePage,
});

function CreatorProfilePage() {
  const { userId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const isSelf = user.id === userId;

  const { data: profile, isLoading } = useQuery({
    queryKey: ["ot-creator-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, pi_username")
        .eq("id", userId)
        .maybeSingle();
      return data;
    },
  });

  const { data: tokens = [] } = useQuery({
    queryKey: ["ot-creator-tokens", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tokens")
        .select("*")
        .eq("creator_id", userId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: followerCount = 0 } = useQuery({
    queryKey: ["ot-followers", userId],
    queryFn: async () => {
      const { count } = await supabase
        .from("ot_follows")
        .select("*", { count: "exact", head: true })
        .eq("creator_id", userId);
      return count ?? 0;
    },
  });

  const { data: following } = useQuery({
    queryKey: ["ot-following", userId, user.id],
    enabled: !isSelf,
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_follows")
        .select("creator_id")
        .eq("creator_id", userId)
        .eq("follower_id", user.id)
        .maybeSingle();
      return !!data;
    },
  });

  const { data: tradeStats } = useQuery({
    queryKey: ["ot-creator-stats", userId],
    queryFn: async () => {
      const { count } = await supabase
        .from("ot_trades")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      const vol = tokens.reduce((s: number, t: any) => s + Number(t.volume_24h ?? 0), 0);
      const verified = tokens.some((t: any) => t.is_verified);
      return { trades: count ?? 0, volume: vol, verified };
    },
  });

  async function toggleFollow() {
    try {
      if (following) {
        await supabase
          .from("ot_follows")
          .delete()
          .eq("creator_id", userId)
          .eq("follower_id", user.id);
        toast.success("Unfollowed");
      } else {
        await supabase.from("ot_follows").insert({ creator_id: userId, follower_id: user.id });
        toast.success("Following");
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ot-following", userId, user.id] }),
        qc.invalidateQueries({ queryKey: ["ot-followers", userId] }),
      ]);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  const name = profile?.display_name || profile?.username || profile?.pi_username || "Creator";
  const handle = profile?.username ? `@${profile.username}` : null;

  return (
    <div className="animate-page-in space-y-5">
      <Button asChild variant="ghost" size="icon" className="rounded-full">
        <Link to="/opentoken">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>

      <Card className="rounded-2xl border-0 shadow-none p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{name}</h1>
                {tradeStats?.verified && <BadgeCheck className="h-5 w-5 text-primary" />}
              </div>
              {handle && <div className="text-sm text-muted-foreground">{handle}</div>}
              {profile?.pi_username && (
                <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                  Pi · @{profile.pi_username}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>
                  <strong className="text-foreground">{followerCount}</strong> followers
                </span>
                <span>
                  <strong className="text-foreground">{tokens.length}</strong> coins
                </span>
                <span>
                  <strong className="text-foreground">{tradeStats?.trades ?? 0}</strong> trades
                </span>
                <span>
                  <strong className="text-foreground">
                    {formatUSD(tradeStats?.volume ?? 0, { compact: true })}
                  </strong>{" "}
                  vol
                </span>
              </div>
            </div>
          </div>
          {!isSelf && (
            <Button
              className="rounded-full"
              variant={following ? "outline" : "default"}
              onClick={toggleFollow}
            >
              {following ? (
                <>
                  <UserMinus className="mr-1.5 h-4 w-4" /> Unfollow
                </>
              ) : (
                <>
                  <UserPlus className="mr-1.5 h-4 w-4" /> Follow
                </>
              )}
            </Button>
          )}
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Created tokens</h2>
        {tokens.length === 0 ? (
          <Card className="rounded-2xl border-border/60 p-8 text-center text-sm text-muted-foreground">
            No tokens launched yet
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {tokens.map((t: any) => (
              <TokenCard key={t.id} token={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
