/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Upload,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/wallet/PageHeader";
import { TokenCard } from "@/components/opentoken";
import { formatCurrency, useCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/wallet-utils";

export const Route = createFileRoute("/_authenticated/opentoken_/creator/$userId")({
  head: () => ({ meta: [{ title: "Creator — OpenToken" }] }),
  component: CreatorProfilePage,
});

function normalizeWebsite(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v.slice(0, 200);
  return `https://${v}`.slice(0, 200);
}

function normalizeTwitter(raw: string): string | null {
  const v = raw.trim().replace(/^@+/, "");
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v.slice(0, 200);
  return `https://x.com/${v}`.slice(0, 200);
}

function twitterHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = String(url).match(/(?:x\.com|twitter\.com)\/(@?[\w]+)/i);
  if (m?.[1]) return m[1].replace(/^@/, "");
  if (!/^https?:\/\//i.test(url)) return url.replace(/^@/, "");
  return null;
}

function CreatorProfilePage() {
  const { userId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const { code: currency } = useCurrency();
  const isSelf = user.id === userId;

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [followBusy, setFollowBusy] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["ot-creator-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, display_name, username, avatar_url, pi_username, bio, website_url, twitter_url",
        )
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        // Older DBs without bio columns — fall back
        const { data: fallback } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url, pi_username")
          .eq("id", userId)
          .maybeSingle();
        return fallback as typeof data;
      }
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

  const { data: tradeCount = 0 } = useQuery({
    queryKey: ["ot-creator-trades", userId],
    queryFn: async () => {
      const { count } = await supabase
        .from("ot_trades")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name || "");
    setUsername(profile.username || "");
    setBio((profile as { bio?: string | null }).bio || "");
    setWebsite((profile as { website_url?: string | null }).website_url || "");
    const tw = (profile as { twitter_url?: string | null }).twitter_url;
    setTwitter(twitterHandle(tw) || tw || "");
  }, [profile]);

  const volume = tokens.reduce((s: number, t: any) => s + Number(t.volume_24h ?? 0), 0);
  const verified = tokens.some((t: any) => t.is_verified);
  const name =
    profile?.display_name || profile?.username || profile?.pi_username || "Creator";
  const handle = profile?.username
    ? `@${profile.username}`
    : profile?.pi_username
      ? `@${profile.pi_username}`
      : null;
  const profileBio = (profile as { bio?: string | null } | null)?.bio?.trim() || "";
  const websiteUrl = (profile as { website_url?: string | null } | null)?.website_url;
  const twitterUrl = (profile as { twitter_url?: string | null } | null)?.twitter_url;
  const twLabel = twitterHandle(twitterUrl);

  async function invalidateProfile() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["ot-creator-profile", userId] }),
      qc.invalidateQueries({ queryKey: ["profile", user.id] }),
    ]);
  }

  async function saveSetup() {
    if (!isSelf) return;
    setSaving(true);
    try {
      const dn = displayName.trim() || null;
      const un = username.trim().replace(/^@+/, "").toLowerCase() || null;
      const payload: Record<string, string | null> = {
        display_name: dn,
        username: un,
        bio: bio.trim().slice(0, 280) || null,
        website_url: normalizeWebsite(website),
        twitter_url: normalizeTwitter(twitter),
      };
      const { error } = await supabase.from("profiles").update(payload as never).eq("id", user.id);
      if (error) {
        // Retry without new columns if migration not applied yet
        if (/bio|website_url|twitter_url/i.test(error.message)) {
          const { error: e2 } = await supabase
            .from("profiles")
            .update({ display_name: dn, username: un })
            .eq("id", user.id);
          if (e2) throw e2;
          toast.message("Saved name — apply bio migration for full creator setup");
        } else {
          throw error;
        }
      } else {
        toast.success("Creator profile updated");
      }
      setEditOpen(false);
      await invalidateProfile();
    } catch (e) {
      toast.error((e as Error).message || "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (!isSelf) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Read failed"));
        reader.readAsDataURL(file);
      });
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: dataUrl })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Photo updated");
      await invalidateProfile();
    } catch (e) {
      toast.error((e as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function toggleFollow() {
    if (isSelf || followBusy) return;
    setFollowBusy(true);
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
    } finally {
      setFollowBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="ot-phantom ph-page flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = [
    { label: "Followers", value: String(followerCount) },
    { label: "Coins", value: String(tokens.length) },
    { label: "Trades", value: String(tradeCount) },
    {
      label: "Vol",
      value: formatCurrency(volume, currency, { compact: true }) || formatUSD(volume, { compact: true }),
    },
  ];

  return (
    <div className="ot-phantom ph-page space-y-6 pb-10">
      <PageHeader
        title={isSelf ? "Your profile" : "Creator"}
        backTo="/opentoken"
        right={
          isSelf ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Edit creator setup"
              onClick={() => setEditOpen((v) => !v)}
            >
              <Pencil className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          ) : null
        }
      />

      {/* Phantom-style centered hero */}
      <div className="flex flex-col items-center gap-3 px-1 pt-1 text-center">
        <div className="relative">
          <Avatar className="h-24 w-24 ring-4 ring-background shadow-sm">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/15 text-2xl font-bold text-primary">
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isSelf && (
            <label className="absolute -bottom-0.5 -right-0.5 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-foreground text-background shadow press">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAvatar(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{name}</h1>
            {verified ? <BadgeCheck className="h-5 w-5 text-primary" aria-label="Verified" /> : null}
          </div>
          {handle ? <p className="text-sm text-muted-foreground">{handle}</p> : null}
        </div>

        {profileBio ? (
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{profileBio}</p>
        ) : isSelf && !editOpen ? (
          <p className="text-sm text-muted-foreground/80">Add a bio so traders know who you are</p>
        ) : null}

        {(websiteUrl || twLabel) && (
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-medium">
            {websiteUrl ? (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Website <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            {twitterUrl ? (
              <a
                href={twitterUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                @{twLabel || "x"} <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        )}

        {/* Stats strip — flat Phantom, not a card */}
        <div className="mt-2 grid w-full max-w-md grid-cols-4 gap-1">
          {stats.map((s) => (
            <div key={s.label} className="px-1 py-2">
              <div className="text-sm font-bold tabular-nums text-foreground">{s.value}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex w-full max-w-sm flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
          {isSelf ? (
            <>
              <Button
                type="button"
                className="h-11 flex-1 rounded-full font-semibold"
                variant={editOpen ? "secondary" : "default"}
                onClick={() => setEditOpen((v) => !v)}
              >
                <Pencil className="mr-1.5 h-4 w-4" />
                {editOpen ? "Close setup" : "Edit setup"}
              </Button>
              <Button asChild variant="secondary" className="h-11 flex-1 rounded-full font-semibold">
                <Link to="/opentoken/create">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create coin
                </Link>
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="h-11 w-full rounded-full font-semibold"
              variant={following ? "secondary" : "default"}
              disabled={followBusy}
              onClick={() => void toggleFollow()}
            >
              {followBusy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : following ? (
                <UserMinus className="mr-1.5 h-4 w-4" />
              ) : (
                <UserPlus className="mr-1.5 h-4 w-4" />
              )}
              {following ? "Following" : "Follow"}
            </Button>
          )}
        </div>
      </div>

      {/* Edit setup panel */}
      {isSelf && editOpen && (
        <div className="space-y-3 rounded-3xl bg-card px-4 py-4">
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">Creator setup</p>
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
              This is how you appear on OpenToken — name, handle, bio, and links.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Display name
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-12 rounded-2xl border-0 bg-muted/60"
              maxLength={48}
              placeholder="Creator"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Username
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              className="h-12 rounded-2xl border-0 bg-muted/60"
              maxLength={32}
              placeholder="openpay"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Bio
            </label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 280))}
              className="min-h-22 resize-none rounded-2xl border-0 bg-muted/60"
              placeholder="Tell traders what you build…"
              maxLength={280}
            />
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
              {bio.length}/280
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Website
            </label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="h-12 rounded-2xl border-0 bg-muted/60"
              placeholder="https://…"
              maxLength={200}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              X / Twitter
            </label>
            <Input
              value={twitter}
              onChange={(e) => setTwitter(e.target.value.replace(/^@+/, ""))}
              className="h-12 rounded-2xl border-0 bg-muted/60"
              placeholder="handle"
              maxLength={64}
            />
          </div>
          <Button
            type="button"
            className="mt-1 h-12 w-full rounded-full text-base font-semibold"
            disabled={saving}
            onClick={() => void saveSetup()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save setup"}
          </Button>
        </div>
      )}

      {/* Created tokens */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-foreground">Created tokens</h2>
          <span className="text-xs tabular-nums text-muted-foreground">{tokens.length}</span>
        </div>

        {tokens.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-muted/40 px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">No tokens launched yet</p>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              {isSelf
                ? "Launch your first coin on OpenToken — it shows up here for followers."
                : "This creator hasn’t launched a coin yet."}
            </p>
            {isSelf ? (
              <Button asChild className="mt-1 h-11 rounded-full px-6 font-semibold">
                <Link to="/opentoken/create">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create coin
                </Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className={cn("grid gap-3", "grid-cols-2 md:grid-cols-3")}>
            {tokens.map((t: any) => (
              <TokenCard key={t.id} token={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
