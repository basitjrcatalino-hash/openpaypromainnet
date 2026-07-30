import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronRight,
  Copy,
  Link2,
  Loader2,
  Settings as SettingsIcon,
  Shield,
  Upload,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";

import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/wallet/PageHeader";
import { WalletAvatar } from "@/components/wallet/WalletAvatar";
import { WalletSwitcherDialog } from "@/components/wallet/WalletSwitcherDialog";
import { getOpenPayLinkStatus, startOpenPayConnect } from "@/lib/openpay-pro.functions";
import { stashOpenPayConnectReturn } from "@/lib/openpay-connect-return";
import { fetchActiveWallet, listUserWallets, shortAddress } from "@/lib/wallet-utils";
import { useCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — OpenPay Pro" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const getLink = useServerFn(getOpenPayLinkStatus);
  const startConnect = useServerFn(startOpenPayConnect);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { code: currency } = useCurrency();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("display_name, username, avatar_url, pi_username, pi_wallet_address")
          .eq("id", user.id)
          .maybeSingle()
      ).data,
  });

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: () =>
      fetchActiveWallet<{ id: string; address: string; name: string | null }>(
        supabase,
        user.id,
        "id, address, name",
      ),
  });

  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets", user.id],
    queryFn: () => listUserWallets(supabase, user.id, "id, address, name, is_active"),
  });

  const { data: openpayLink } = useQuery({
    queryKey: ["openpay-link", user.id],
    queryFn: () => getLink(),
  });

  useEffect(() => {
    if (!profile) return;
    setDisplayName((profile.display_name as string) || "");
    setUsername((profile.username as string) || "");
  }, [profile]);

  async function saveProfile() {
    setSaving(true);
    try {
      const dn = displayName.trim() || null;
      const un = username.trim().replace(/^@+/, "").toLowerCase() || null;
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: dn, username: un })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated");
      setEditOpen(false);
      await qc.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (e) {
      toast.error((e as Error).message || "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
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
      toast.success("Avatar updated");
      await qc.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (e) {
      toast.error((e as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function copyAddress() {
    if (!wallet?.address) return;
    try {
      await copyText(wallet.address);
      toast.success("Address copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  async function connectOpenPay() {
    try {
      stashOpenPayConnectReturn("/profile");
      const res = await startConnect({ data: { return_path: "/profile" } });
      if (res?.authorize_url) window.location.href = res.authorize_url;
    } catch (e) {
      toast.error((e as Error).message || "Could not start OpenPay connect");
    }
  }

  const handle =
    profile?.username || profile?.pi_username || profile?.display_name || "wallet";

  return (
    <div className="ot-phantom ph-page space-y-5 pb-10">
      <PageHeader title="Profile" backTo="/dashboard" />

      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <div className="relative">
          <Avatar className="h-24 w-24 ring-4 ring-border/60">
            <AvatarImage src={(profile as { avatar_url?: string } | null)?.avatar_url} />
            <AvatarFallback className="bg-primary/15 text-2xl font-bold text-primary">
              {String(handle).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <label className="absolute -bottom-1 -right-1 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-primary text-primary-foreground shadow press">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
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
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {(profile?.display_name as string) || "OpenPay Pro"}
          </h1>
          <p className="text-sm text-muted-foreground">@{handle}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="rounded-full"
          onClick={() => setEditOpen((v) => !v)}
        >
          Edit profile
        </Button>
      </div>

      {editOpen && (
        <div className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Display name
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-11 rounded-2xl"
              maxLength={48}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Username
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              className="h-11 rounded-2xl"
              maxLength={32}
              placeholder="openpay"
            />
          </div>
          <Button
            type="button"
            className="h-11 w-full rounded-full font-semibold"
            disabled={saving}
            onClick={() => void saveProfile()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setSwitchOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left press hover:bg-muted/40"
        >
          {wallet ? (
            <WalletAvatar address={wallet.address} name={wallet.name} size="sm" active />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full bg-muted">
              <Wallet className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{wallet?.name ?? "Wallet"}</div>
            <div className="truncate font-mono text-xs text-muted-foreground">
              {shortAddress(wallet?.address ?? null, 8, 6)}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1 rounded-full"
            onClick={() => void copyAddress()}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1 rounded-full"
            asChild
          >
            <Link to="/settings">Manage</Link>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <Row
          label="OpenPay"
          value={
            openpayLink?.linked
              ? `@${openpayLink.username || "linked"}`
              : "Not connected"
          }
          action={
            openpayLink?.linked ? undefined : (
              <button
                type="button"
                onClick={() => void connectOpenPay()}
                className="text-xs font-semibold text-primary"
              >
                Connect
              </button>
            )
          }
        />
        <Row
          label="Pi Network"
          value={
            profile?.pi_username
              ? `@${profile.pi_username}`
              : profile?.pi_wallet_address
                ? shortAddress(profile.pi_wallet_address as string, 6, 4)
                : "Not linked"
          }
          last
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <Link
          to="/settings"
          className="flex items-center gap-3 px-4 py-3.5 press hover:bg-muted/40"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-muted">
            <SettingsIcon className="h-4 w-4" />
          </span>
          <span className="flex-1 text-sm font-semibold">Settings</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link
          to="/settings"
          className="flex items-center gap-3 border-t border-border px-4 py-3.5 press hover:bg-muted/40"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-muted">
            <Shield className="h-4 w-4" />
          </span>
          <span className="flex-1 text-sm font-semibold">Security</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link
          to="/watchlist"
          className="flex items-center gap-3 border-t border-border px-4 py-3.5 press hover:bg-muted/40"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-muted">
            <Link2 className="h-4 w-4" />
          </span>
          <span className="flex-1 text-sm font-semibold">Watchlist</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      <WalletSwitcherDialog
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        wallets={wallets as never}
        activeWalletId={wallet?.id}
        currency={currency}
        onSelect={async (id) => {
          await supabase.from("wallets").update({ is_active: false }).eq("user_id", user.id);
          await supabase.from("wallets").update({ is_active: true }).eq("id", id);
          await Promise.all([
            qc.invalidateQueries({ queryKey: ["wallets", user.id] }),
            qc.invalidateQueries({ queryKey: ["active-wallet", user.id] }),
            qc.invalidateQueries({ queryKey: ["wallet-portfolio-totals"] }),
          ]);
          setSwitchOpen(false);
          toast.success("Wallet switched");
        }}
      />
    </div>
  );
}

function Row({
  label,
  value,
  action,
  last,
}: {
  label: string;
  value: string;
  action?: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3.5 text-sm",
        !last && "border-b border-border",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-semibold text-foreground">
        {value}
        {action}
      </span>
    </div>
  );
}
