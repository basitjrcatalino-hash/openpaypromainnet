import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import {
  Plus,
  Trash2,
  Check,
  Wallet as WalletIcon,
  KeyRound,
  ShieldCheck,
  Link2,
  Loader2,
  Copy,
  RefreshCw,
  Upload,
  ScrollText,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/wallet/PageHeader";
import { useTheme } from "@/components/theme-provider";
import { generateAddress, generateMnemonic, shortAddress } from "@/lib/wallet-utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  unlinkOpenPayAccount,
  startOpenPayConnect,
  getOpenPayLinkStatus,
} from "@/lib/openpay-pro.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — OpenPay Pro Wallet" }] }),
  component: SettingsPage,
});

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [importPhrase, setImportPhrase] = useState("");
  const [creating, setCreating] = useState(false);
  const [mnemonic, setMnemonic] = useState<string[] | null>(null);

  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets", user.id],
    queryFn: async () =>
      (
        await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: true })
      ).data ?? [],
  });

  const { data: prefs } = useQuery({
    queryKey: ["prefs", user.id],
    queryFn: async (): Promise<Record<string, any>> => {
      const [{ data: row }, { data: hasPin }] = await Promise.all([
        supabase
          .from("user_preferences")
          .select(
            "user_id,currency,language,theme,biometric_enabled,recovery_backed_up,notifications,created_at,updated_at",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.rpc("has_user_pin"),
      ]);
      return { ...((row as Record<string, any>) ?? {}), pin_set: !!hasPin };
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data,
  });

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (profile) {
      if (profile.display_name && !displayName) setDisplayName(profile.display_name as string);
      if ((profile as any).username && !username) setUsername((profile as any).username as string);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.display_name, (profile as any)?.username]);

  async function saveProfile() {
    const dn = displayName.trim();
    const un = username.trim().replace(/^@/, "");
    if (!dn) {
      toast.error("Display name required");
      return;
    }
    if (un && !/^[a-zA-Z0-9_.-]{3,30}$/.test(un)) {
      toast.error("Username 3-30 chars, letters/digits/._- only");
      return;
    }
    setSavingName(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        display_name: dn,
        username: un || null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingName(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (file.size > 800_000) {
      toast.error("Max 800KB");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        avatar_url: dataUrl,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Avatar updated");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function createWallet() {
    if (!newName.trim()) {
      toast.error("Name required");
      return;
    }
    setCreating(true);
    try {
      const m = generateMnemonic();
      setMnemonic(m);
      await supabase
        .from("wallets")
        .insert({ user_id: user.id, name: newName.trim(), address: generateAddress() });
      toast.success("Wallet created");
      setNewName("");
      qc.invalidateQueries({ queryKey: ["wallets", user.id] });
      qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function importWallet() {
    if (importPhrase.trim().split(/\s+/).length < 12) {
      toast.error("Enter a 12-word phrase");
      return;
    }
    setCreating(true);
    try {
      await supabase
        .from("wallets")
        .insert({ user_id: user.id, name: "Imported wallet", address: generateAddress() });
      toast.success("Wallet imported");
      setImportPhrase("");
      qc.invalidateQueries({ queryKey: ["wallets", user.id] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function setActive(id: string) {
    await supabase.from("wallets").update({ is_active: false }).eq("user_id", user.id);
    await supabase.from("wallets").update({ is_active: true }).eq("id", id);
    toast.success("Active wallet switched");
    qc.invalidateQueries({ queryKey: ["wallets", user.id] });
    qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
    router.invalidate();
  }

  async function removeWallet(id: string) {
    if (wallets.length <= 1) {
      toast.error("Keep at least one wallet");
      return;
    }
    await supabase.from("wallets").delete().eq("id", id);
    toast.success("Wallet removed");
    qc.invalidateQueries({ queryKey: ["wallets", user.id] });
    qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
  }

  async function updatePref(patch: Record<string, any>) {
    // Always merge notifications against the latest DB row so a stale React
    // Query cache cannot wipe the persisted OpenPay connect session.
    if (patch.notifications && typeof patch.notifications === "object") {
      const { data: row } = await supabase
        .from("user_preferences")
        .select("notifications")
        .eq("user_id", user.id)
        .maybeSingle();
      const latest = (row?.notifications as Record<string, unknown> | null) ?? {};
      const next = {
        ...latest,
        ...(patch.notifications as Record<string, unknown>),
      };
      // Preserve OpenPay link unless this patch explicitly clears it
      if (
        latest.openpay &&
        !Object.prototype.hasOwnProperty.call(patch.notifications, "openpay")
      ) {
        next.openpay = latest.openpay;
      }
      patch = { ...patch, notifications: next };
    }
    await supabase
      .from("user_preferences")
      .upsert({ user_id: user.id, ...patch, updated_at: new Date().toISOString() });
    qc.invalidateQueries({ queryKey: ["prefs", user.id] });
    qc.invalidateQueries({ queryKey: ["openpay-link", user.id] });
  }

  return (
    <div className="ot-phantom ph-page mx-auto max-w-lg space-y-6 pb-8 md:max-w-2xl">
      <PageHeader title="Settings" />
      <p className="-mt-2 text-center text-sm text-muted-foreground md:text-left">
        Account, security, and connections
      </p>

      {/* Account */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Account
        </h2>
      <div className="overflow-hidden rounded-2xl bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Profile</h2>
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-20 w-20 ring-2 ring-primary/30">
              <AvatarImage src={(profile as any)?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-lg text-primary">
                {(displayName || user.email || "U")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}{" "}
              Photo
            </Button>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <Label htmlFor="dn">Display name</Label>
              <Input
                id="dn"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={40}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="un">Username</Label>
              <Input
                id="un"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                maxLength={30}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Others can send to you using{" "}
                <span className="font-mono">@{username || "yourname"}</span>. Email:{" "}
                <span className="font-mono">{user.email}</span>
                {(profile as any)?.pi_username && (
                  <>
                    {" "}
                    · Pi: <span className="font-mono">@{(profile as any).pi_username}</span>
                  </>
                )}
              </p>
            </div>
            <Button
              onClick={saveProfile}
              disabled={savingName}
              className="rounded-full bg-primary text-primary-foreground"
            >
              {savingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save profile
            </Button>
          </div>
        </div>
      </div>
      </section>

      {/* Wallets */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Wallets
        </h2>
      <div className="overflow-hidden rounded-2xl bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Your wallets</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="rounded-full bg-primary text-primary-foreground"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add wallet
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-3xl">
              <DialogHeader>
                <DialogTitle>Add wallet</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="create">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="create">Create</TabsTrigger>
                  <TabsTrigger value="import">Import</TabsTrigger>
                </TabsList>
                <TabsContent value="create" className="mt-4 space-y-3">
                  <Label>Wallet name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Trading"
                  />
                  <Button
                    onClick={createWallet}
                    disabled={creating}
                    className="w-full rounded-2xl bg-primary text-primary-foreground"
                  >
                    {creating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <WalletIcon className="mr-2 h-4 w-4" />
                    )}{" "}
                    Generate wallet
                  </Button>
                  {mnemonic && (
                    <div className="rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs">
                      <div className="mb-2 font-semibold">⚠️ Save your recovery phrase</div>
                      <div className="grid grid-cols-3 gap-2 font-mono">
                        {mnemonic.map((w, i) => (
                          <div key={i} className="rounded-md bg-card px-2 py-1">
                            {i + 1}. {w}
                          </div>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full rounded-full"
                        onClick={() => {
                          navigator.clipboard.writeText(mnemonic.join(" "));
                          toast.success("Phrase copied");
                        }}
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy phrase
                      </Button>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="import" className="mt-4 space-y-3">
                  <Label>12-word recovery phrase</Label>
                  <Input
                    value={importPhrase}
                    onChange={(e) => setImportPhrase(e.target.value)}
                    placeholder="abandon ability able …"
                  />
                  <Button
                    onClick={importWallet}
                    disabled={creating}
                    className="w-full rounded-2xl bg-primary text-primary-foreground"
                  >
                    {creating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="mr-2 h-4 w-4" />
                    )}{" "}
                    Import
                  </Button>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
        <ul className="space-y-2">
          {wallets.map((w: any) => (
            <li
              key={w.id}
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-3"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <WalletIcon className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {w.name}
                    {w.is_active && (
                      <span className="rounded-full bg-mint/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-mint-foreground">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {shortAddress(w.address)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!w.is_active && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setActive(w.id)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Activate
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeWallet(w.id)}
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      </section>

      {/* Security */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Security
        </h2>
      <div className="overflow-hidden rounded-2xl bg-card p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <BiometricCard
            enabled={!!(prefs as any)?.biometric_enabled}
            onToggle={(v) => updatePref({ biometric_enabled: v })}
          />
          <PinCard
            hasPin={!!(prefs as any)?.pin_set}
            onSave={async (pin) => {
              const h = await sha256(`${user.id}:${pin}`);
              await updatePref({ pin_hash: h });
              toast.success("PIN saved");
            }}
            onClear={async () => {
              await updatePref({ pin_hash: null });
              toast.success("PIN removed");
            }}
          />
          <RecoveryCard
            backedUp={!!(prefs as any)?.recovery_backed_up}
            onConfirm={async () => {
              await updatePref({ recovery_backed_up: true });
              toast.success("Marked as backed up");
            }}
          />
        </div>
      </div>
      </section>

      {/* Preferences */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Preferences
        </h2>
      <div className="overflow-hidden rounded-2xl bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <SettingRow label="Theme" desc="Choose how OpenPay looks">
            <div className="inline-flex rounded-full border border-border bg-card p-1">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTheme(t);
                    updatePref({ theme: t });
                  }}
                  className={`rounded-full px-3 py-1 text-xs capitalize ${theme === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </SettingRow>
          <SettingRow label="Currency" desc="Display fiat values in">
            <select
              value={prefs?.currency ?? "USD"}
              onChange={(e) => updatePref({ currency: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option>USD</option>
              <option>EUR</option>
              <option>GBP</option>
              <option>JPY</option>
            </select>
          </SettingRow>
          <SettingRow label="Language" desc="Interface language">
            <select
              value={prefs?.language ?? "en"}
              onChange={(e) => updatePref({ language: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </SettingRow>
          <SettingRow label="Price alerts" desc="Notify on big moves">
            <Switch
              checked={
                (prefs?.notifications as Record<string, boolean> | null)?.price_alerts ?? true
              }
              onCheckedChange={(v) =>
                updatePref({
                  notifications: {
                    ...((prefs?.notifications as Record<string, boolean> | null) ?? {}),
                    price_alerts: v,
                  },
                })
              }
            />
          </SettingRow>
          <SettingRow label="Transaction alerts" desc="Notify on send, receive & top-ups">
            <Switch
              checked={(prefs?.notifications as Record<string, boolean> | null)?.tx_alerts ?? true}
              onCheckedChange={(v) =>
                updatePref({
                  notifications: {
                    ...((prefs?.notifications as Record<string, boolean> | null) ?? {}),
                    tx_alerts: v,
                  },
                })
              }
            />
          </SettingRow>
          <SettingRow label="Browser push" desc="System notifications when tab is in background">
            <Switch
              checked={
                (prefs?.notifications as Record<string, boolean> | null)?.browser_push ?? false
              }
              onCheckedChange={async (v) => {
                if (v) {
                  const { ensureBrowserPermission } = await import("@/lib/tx-notifications");
                  const perm = await ensureBrowserPermission();
                  if (perm !== "granted") {
                    toast.error("Browser notification permission denied");
                    return;
                  }
                }
                updatePref({
                  notifications: {
                    ...((prefs?.notifications as Record<string, boolean> | null) ?? {}),
                    browser_push: v,
                  },
                });
              }}
            />
          </SettingRow>
        </div>
      </div>
      </section>

      {/* Connected */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Connected
        </h2>
      <OpenPayIntegrationCard userId={user.id} />

      <div className="overflow-hidden rounded-2xl bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 text-primary">
              <ScrollText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold">Ledger API · OpenLedger</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Sync every OpenPay Pro transaction into OpenLedger or any external ledger via API
                key.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <a
                href="https://openledger.lovable.app/pro"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on OpenLedger
              </a>
            </Button>
            <Button asChild className="rounded-full">
              <Link to="/ledger">Open Ledger API</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 text-primary">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold">OpenPay Connect &amp; Payments</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Docs for third-party apps: OAuth Connect, PayButton, and /pay/@username.
              </p>
            </div>
          </div>
          <Button asChild className="rounded-full" variant="outline">
            <a href="/docs/openpay" target="_blank" rel="noreferrer">
              Open docs
            </a>
          </Button>
        </div>
      </div>
      </section>
    </div>
  );
}

function OpenPayIntegrationCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const unlinkOpenPay = useServerFn(unlinkOpenPayAccount);
  const startConnect = useServerFn(startOpenPayConnect);
  const getLink = useServerFn(getOpenPayLinkStatus);

  // Authoritative persisted session — survives reloads until Disconnect
  const { data: stored, isLoading: linkLoading } = useQuery({
    queryKey: ["openpay-link", userId],
    queryFn: () => getLink(),
  });
  const linked = !!stored?.linked;

  const [busy, setBusy] = useState(false);

  async function connectViaOpenPay() {
    if (linked) {
      toast.message("OpenPay is already connected");
      return;
    }
    setBusy(true);
    try {
      const { authorize_url } = await startConnect({
        data: { origin: window.location.origin },
      });
      window.location.href = authorize_url;
    } catch (err) {
      toast.error((err as Error).message || "Could not start OpenPay connect");
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await unlinkOpenPay();
      toast.success("OpenPay disconnected");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["openpay-link", userId] }),
        qc.invalidateQueries({ queryKey: ["prefs", userId] }),
      ]);
    } catch (err) {
      toast.error((err as Error).message || "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  const linkedLabel = stored?.username
    ? `@${stored.username}`
    : stored?.account_number || stored?.identifier || stored?.name || "OpenPay";

  return (
    <div className="overflow-hidden rounded-2xl bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Link2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            OpenPay Integration
          </h2>
          <p className="mt-1 text-sm">
            {linkLoading
              ? "Checking OpenPay connection…"
              : linked
                ? `Connected as ${linkedLabel}${stored?.source === "local" ? " (OpenPay Pro)" : ""}. Session stays linked until you disconnect.`
                : "Connect your OpenPay account. You’ll confirm on OpenPay, then return here linked."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {linkLoading ? (
            <Button variant="ghost" className="rounded-full" disabled>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Checking…
            </Button>
          ) : linked ? (
            <Button variant="ghost" className="rounded-full" disabled={busy} onClick={disconnect}>
              Disconnect
            </Button>
          ) : (
            <Button
              className="rounded-full bg-primary text-primary-foreground"
              disabled={busy}
              onClick={connectViaOpenPay}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Connect with OpenPay
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-4">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      {children}
    </div>
  );
}

function BiometricCard({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function enroll() {
    setBusy(true);
    try {
      if (enabled) {
        await onToggle(false);
        toast.success("Biometric disabled");
        return;
      }
      if (!("credentials" in navigator) || !window.PublicKeyCredential) {
        toast.error("Biometric not supported on this device");
        return;
      }
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));
      await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "OpenPay Pro" },
          user: { id: userId, name: "openpay-user", displayName: "OpenPay User" },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            userVerification: "preferred",
            authenticatorAttachment: "platform",
          },
          timeout: 60_000,
          attestation: "none",
        },
      });
      await onToggle(true);
      toast.success("Biometric enabled");
    } catch (err) {
      toast.error((err as Error).message || "Biometric setup cancelled");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
        <ShieldCheck className="h-4 w-4" />
      </span>
      <div className="mt-2 text-sm font-semibold">
        Biometric login{" "}
        {enabled && <span className="ml-1 text-[10px] uppercase text-mint-foreground">on</span>}
      </div>
      <div className="text-xs text-muted-foreground">Use device biometrics to unlock</div>
      <Button
        size="sm"
        variant="outline"
        className="mt-3 w-full rounded-full"
        onClick={enroll}
        disabled={busy}
      >
        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        {enabled ? "Disable" : "Configure"}
      </Button>
    </div>
  );
}

function PinCard({
  hasPin,
  onSave,
  onClear,
}: {
  hasPin: boolean;
  onSave: (pin: string) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!/^\d{6}$/.test(pin)) {
      toast.error("Enter 6 digits");
      return;
    }
    if (pin !== pin2) {
      toast.error("PINs do not match");
      return;
    }
    setBusy(true);
    try {
      await onSave(pin);
      setOpen(false);
      setPin("");
      setPin2("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
        <KeyRound className="h-4 w-4" />
      </span>
      <div className="mt-2 text-sm font-semibold">
        PIN code{" "}
        {hasPin && <span className="ml-1 text-[10px] uppercase text-mint-foreground">set</span>}
      </div>
      <div className="text-xs text-muted-foreground">Add a 6-digit PIN for transactions</div>
      <div className="mt-3 flex gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="flex-1 rounded-full">
              {hasPin ? "Change" : "Configure"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Set transaction PIN</DialogTitle>
              <DialogDescription>6 digits, used to confirm sends.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="Confirm PIN"
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={save}
                disabled={busy}
                className="rounded-full bg-primary text-primary-foreground"
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save PIN
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {hasPin && (
          <Button size="sm" variant="ghost" className="rounded-full" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

function RecoveryCard({
  backedUp,
  onConfirm,
}: {
  backedUp: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState<string[] | null>(null);
  function reveal() {
    setPhrase(generateMnemonic());
    setOpen(true);
  }
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
        <RefreshCw className="h-4 w-4" />
      </span>
      <div className="mt-2 text-sm font-semibold">
        Recovery phrase{" "}
        {backedUp && <span className="ml-1 text-[10px] uppercase text-mint-foreground">saved</span>}
      </div>
      <div className="text-xs text-muted-foreground">Backup your seed phrase</div>
      <Dialog open={open} onOpenChange={setOpen}>
        <Button size="sm" variant="outline" className="mt-3 w-full rounded-full" onClick={reveal}>
          Reveal phrase
        </Button>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Your recovery phrase</DialogTitle>
            <DialogDescription>
              Write these 12 words down and store offline. Anyone with these words controls your
              wallet.
            </DialogDescription>
          </DialogHeader>
          {phrase && (
            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              {phrase.map((w, i) => (
                <div key={i} className="rounded-md bg-card px-2 py-1.5 border border-border/60">
                  {i + 1}. {w}
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                if (phrase) {
                  navigator.clipboard.writeText(phrase.join(" "));
                  toast.success("Copied");
                }
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy
            </Button>
            <Button
              className="rounded-full bg-primary text-primary-foreground"
              onClick={async () => {
                await onConfirm();
                setOpen(false);
              }}
            >
              I've backed it up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
