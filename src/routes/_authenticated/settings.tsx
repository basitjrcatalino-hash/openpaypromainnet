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
  FileText,
  Shield,
  LogOut,
  Pencil,
  AlertTriangle,
  ChevronRight,
  CircleDollarSign,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { copyText as copyToClipboardRobust } from "@/lib/clipboard";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/wallet/PageHeader";
import { WalletAvatar } from "@/components/wallet/WalletAvatar";
import { ManageWalletsSheet } from "@/components/wallet/ManageWalletsSheet";
import { CurrencyPickerSheet } from "@/components/wallet/CurrencyPickerSheet";
import { LanguagePickerSheet } from "@/components/wallet/LanguagePickerSheet";
import { useTheme } from "@/components/theme-provider";
import { PhantomSettingsRows } from "@/components/phantom-settings";
import { requestWalletLock, notifyLockPasswordChanged } from "@/components/app-lock-screen";
import {
  clearSessionUnlock,
  hashLockPassword,
  rememberLockEnabled,
  validateLockPassword,
} from "@/lib/app-lock";
import { currencyListLabel, getCurrencyMeta, useCurrency, type CurrencyCode } from "@/lib/currency";
import { useLanguage } from "@/lib/language";
import { getLanguageMeta } from "@/i18n/languages";
import { useTranslation } from "react-i18next";
import "@/i18n";
import type { Json, Tables } from "@/integrations/supabase/types";
import {
  createFreshRecoveryWallet,
  deriveWalletFromPhrase,
  formatUSD,
  listUserWallets,
  normalizeMnemonic,
  isValidMnemonicLength,
  peekRecoveryPhrase,
  shortAddress,
  stashRecoveryPhrase,
  generateMnemonic,
  recoveryHashFromPhrase,
} from "@/lib/wallet-utils";
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
import { stashOpenPayConnectReturn } from "@/lib/openpay-connect-return";
import { OPENPAY_PARTNER_PORTAL } from "@/lib/openpay-auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — OpenPay Pro Wallet" }] }),
  component: SettingsPage,
});

type SettingsWallet = {
  id: string;
  user_id: string;
  name: string;
  address: string;
  is_active: boolean;
  ousd_balance: number | null;
  pi_balance: number | null;
  created_at: string;
};

type UserPrefs = Partial<Tables<"user_preferences">> & {
  pin_set?: boolean;
};

type PrefPatch = Partial<
  Pick<
    Tables<"user_preferences">,
    "currency" | "language" | "theme" | "biometric_enabled" | "recovery_backed_up" | "pin_hash"
  >
> & {
  notifications?: Record<string, unknown>;
};

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [importPhrase, setImportPhrase] = useState("");
  const [importAddress, setImportAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [mnemonic, setMnemonic] = useState<string[] | null>(null);
  const [createdAddress, setCreatedAddress] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<"create" | "import">("create");
  const [manageOpen, setManageOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const { code: displayCurrency, setCode: setDisplayCurrency } = useCurrency();
  const { code: displayLanguage, setCode: setDisplayLanguage } = useLanguage();
  const [signingOut, setSigningOut] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: walletsData } = useQuery({
    queryKey: ["wallets", user.id],
    queryFn: () => listUserWallets<SettingsWallet>(supabase, user.id),
  });
  const wallets = Array.isArray(walletsData) ? walletsData : [];

  const { data: recoveryFlagsData } = useQuery({
    queryKey: ["wallet-recovery-flags", user.id, wallets.map((w) => w.id).join(",")],
    enabled: wallets.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        wallets.map(async (w) => {
          try {
            const { data, error } = await supabase.rpc("wallet_has_recovery", {
              p_wallet_id: w.id,
            });
            if (error) return [w.id, false] as const;
            return [w.id, !!data] as const;
          } catch {
            return [w.id, false] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, boolean>;
    },
  });
  const recoveryFlags =
    recoveryFlagsData && typeof recoveryFlagsData === "object" ? recoveryFlagsData : {};

  const { data: prefs } = useQuery({
    queryKey: ["prefs", user.id],
    queryFn: async (): Promise<UserPrefs | null> => {
      const [{ data: row }, { data: hasPin }] = await Promise.all([
        supabase
          .from("user_preferences")
          .select(
            "user_id,currency,language,theme,biometric_enabled,recovery_backed_up,notifications,updated_at",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.rpc("has_user_pin"),
      ]);
      if (!row) return { pin_set: !!hasPin } as UserPrefs;
      return { ...row, pin_set: !!hasPin };
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
      if (profile.display_name && !displayName) setDisplayName(profile.display_name);
      if (profile.username && !username) setUsername(profile.username);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.display_name, profile?.username]);

  function resetAddDialog() {
    setNewName("");
    setImportPhrase("");
    setImportAddress("");
    setMnemonic(null);
    setCreatedAddress(null);
    setAddTab("create");
  }

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
      const derived = await createFreshRecoveryWallet();
      await supabase.from("wallets").update({ is_active: false }).eq("user_id", user.id);
      let inserted: { id: string; address: string; name: string } | null = null;

      const withHash = await supabase
        .from("wallets")
        .insert({
          user_id: user.id,
          name: newName.trim(),
          address: derived.address,
          recovery_hash: derived.recovery_hash,
          is_active: true,
          ousd_balance: 0,
          pi_balance: 0,
        } as never)
        .select("id,address,name")
        .single();

      if (withHash.error) {
        const msg = withHash.error.message.toLowerCase();
        if (!msg.includes("recovery_hash")) throw withHash.error;
        const legacy = await supabase
          .from("wallets")
          .insert({
            user_id: user.id,
            name: newName.trim(),
            address: derived.address,
            is_active: true,
            ousd_balance: 0,
            pi_balance: 0,
          })
          .select("id,address,name")
          .single();
        if (legacy.error) throw legacy.error;
        inserted = legacy.data;
      } else {
        inserted = withHash.data;
      }

      stashRecoveryPhrase(inserted.id, derived.phrase);
      setMnemonic(derived.words);
      setCreatedAddress(inserted.address);
      toast.success("Wallet created — save your recovery phrase");
      setNewName("");
      qc.invalidateQueries({ queryKey: ["wallets", user.id] });
      qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
      qc.invalidateQueries({ queryKey: ["wallet-recovery-flags", user.id] });
      router.invalidate();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function importWallet() {
    const words = normalizeMnemonic(importPhrase);
    if (!isValidMnemonicLength(words)) {
      toast.error("Enter a valid 12- or 24-word recovery phrase");
      return;
    }
    setCreating(true);
    try {
      const derived = await deriveWalletFromPhrase(words);
      const optionalAddr = importAddress.trim();
      const { data, error } = await supabase.rpc("import_openpay_wallet", {
        p_recovery_hash: derived.recovery_hash,
        p_address: derived.address,
        p_name: newName.trim() || "Imported wallet",
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes("import_openpay_wallet") ||
          msg.includes("could not find the function") ||
          msg.includes("schema cache")
        ) {
          throw new Error(
            "Wallet recovery migration not applied yet. Run 20260729010000_wallet_recovery_import.sql, then retry.",
          );
        }
        throw error;
      }
      const row = data as {
        id: string;
        address: string;
        name: string;
        ousd_balance?: number;
        pi_balance?: number;
      };
      if (optionalAddr && optionalAddr.toLowerCase() !== String(row.address).toLowerCase()) {
        toast.message(
          `Restored ${shortAddress(row.address)} — phrase controls this OpenPay Pro ledger`,
        );
      }
      stashRecoveryPhrase(row.id, derived.phrase);
      const bal = Number(row.ousd_balance ?? 0);
      toast.success(
        bal > 0
          ? `Imported ${row.name} · ${formatUSD(bal)} OUSD`
          : `Imported ${row.name} · ${shortAddress(row.address)}`,
      );
      setImportPhrase("");
      setImportAddress("");
      setAddOpen(false);
      resetAddDialog();
      qc.invalidateQueries({ queryKey: ["wallets", user.id] });
      qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
      qc.invalidateQueries({ queryKey: ["wallet-recovery-flags", user.id] });
      qc.invalidateQueries({ queryKey: ["holdings"] });
      router.invalidate();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function importByAddressOnly() {
    const addr = importAddress.trim();
    if (!addr) {
      toast.error("Paste an OpenPay Pro wallet address");
      return;
    }
    const match = wallets.find((w) => (w.address ?? "").toLowerCase() === addr.toLowerCase());
    if (!match) {
      toast.error("Address not in your account — import with the recovery phrase to restore it");
      return;
    }
    await setActive(match.id);
    setAddOpen(false);
    resetAddDialog();
  }

  async function setActive(id: string) {
    const current = wallets.find((w) => w.is_active);
    if (current?.id === id) return;
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
    const { error } = await supabase.rpc("remove_openpay_wallet" as never, { p_wallet_id: id } as never);
    if (error) {
      // Fallback before soft-delete migration is applied
      const wasActive = wallets.some((w) => w.id === id && w.is_active);
      const { error: delErr } = await supabase.from("wallets").delete().eq("id", id);
      if (delErr) {
        toast.error(error.message);
        return;
      }
      if (wasActive) {
        const next = wallets.find((w) => w.id !== id);
        if (next) await supabase.from("wallets").update({ is_active: true }).eq("id", next.id);
      }
    }
    toast.success("Wallet removed");
    setConfirmDeleteId(null);
    qc.invalidateQueries({ queryKey: ["wallets", user.id] });
    qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
    router.invalidate();
  }

  async function renameWallet() {
    if (!renameId || !renameValue.trim()) return;
    const { error } = await supabase
      .from("wallets")
      .update({ name: renameValue.trim() })
      .eq("id", renameId)
      .eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Wallet renamed");
    setRenameId(null);
    qc.invalidateQueries({ queryKey: ["wallets", user.id] });
    qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
  }

  async function updatePref(patch: PrefPatch) {
    // Always merge notifications against the latest DB row so a stale React
    // Query cache cannot wipe the persisted OpenPay connect session.
    let nextPatch: PrefPatch = { ...patch };
    if (patch.notifications && typeof patch.notifications === "object") {
      const { data: row } = await supabase
        .from("user_preferences")
        .select("notifications")
        .eq("user_id", user.id)
        .maybeSingle();
      const latest =
        row?.notifications &&
        typeof row.notifications === "object" &&
        !Array.isArray(row.notifications)
          ? (row.notifications as Record<string, unknown>)
          : {};
      const next: Record<string, unknown> = {
        ...latest,
        ...patch.notifications,
      };
      // Preserve OpenPay link unless this patch explicitly clears it
      if (latest.openpay && !Object.prototype.hasOwnProperty.call(patch.notifications, "openpay")) {
        next.openpay = latest.openpay;
      }
      nextPatch = { ...patch, notifications: next };
    }
    const { error } = await supabase.from("user_preferences").upsert({
      user_id: user.id,
      ...nextPatch,
      notifications: nextPatch.notifications as Json | undefined,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      toast.error(error.message);
      throw error;
    }
    qc.invalidateQueries({ queryKey: ["prefs", user.id] });
    qc.invalidateQueries({ queryKey: ["openpay-link", user.id] });
  }

  const activeWallet = wallets.find((w) => w.is_active) ?? wallets[0];
  const activeNeedsBackup = activeWallet ? !recoveryFlags[activeWallet.id] : false;

  return (
    <div className="ot-phantom ph-page mx-auto max-w-lg space-y-6 pb-8 md:max-w-2xl">
      <PageHeader title={t("settings.title")} />
      <p className="-mt-2 text-center text-sm text-muted-foreground md:text-left">
        Manage wallets, security, and connections
      </p>

      {/* Account */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("settings.account")}
        </h2>
        <div className="overflow-hidden rounded-2xl bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Profile</h2>
          <div className="flex flex-col gap-5 md:flex-row md:items-start">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-20 w-20 ring-2 ring-primary/30">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
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
                  {profile?.pi_username ? (
                    <>
                      {" "}
                      · Pi: <span className="font-mono">@{profile.pi_username}</span>
                    </>
                  ) : null}
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

      {/* Wallets — Phantom-style drawer selection */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("settings.wallets")}
        </h2>
        <div className="overflow-hidden rounded-2xl bg-card">
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left press hover:bg-muted/40"
          >
            {activeWallet ? (
              <WalletAvatar
                address={activeWallet.address}
                name={activeWallet.name}
                size="lg"
                active
              />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-primary">
                <WalletIcon className="h-5 w-5" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[15px] font-bold">
                  {activeWallet?.name ?? "No wallet"}
                </span>
                {activeWallet?.is_active ? (
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    Active
                  </span>
                ) : null}
              </span>
              {activeWallet ? (
                <>
                  <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                    {shortAddress(activeWallet.address, 6, 4)}
                  </span>
                  <span className="mt-1 block text-lg font-extrabold tabular-nums tracking-tight">
                    {formatUSD(Number(activeWallet.ousd_balance ?? 0))}
                  </span>
                  {activeNeedsBackup ? (
                    <span className="mt-0.5 block text-[11px] font-medium text-amber-500">
                      Needs backup
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {wallets.length} wallet{wallets.length === 1 ? "" : "s"} · tap to switch
                    </span>
                  )}
                </>
              ) : (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Create or import an OpenPay Pro ledger
                </span>
              )}
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </button>

          <div className="grid grid-cols-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => setManageOpen(true)}
              className="flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-foreground hover:bg-muted/40 press"
            >
              <WalletIcon className="h-4 w-4 text-primary" />
              Your wallets
            </button>
            <button
              type="button"
              onClick={() => {
                resetAddDialog();
                setAddOpen(true);
              }}
              className="flex items-center justify-center gap-2 border-l border-border/50 py-3.5 text-sm font-semibold text-primary hover:bg-primary/10 press"
            >
              <Plus className="h-4 w-4" />
              Add wallet
            </button>
          </div>
        </div>

        <ManageWalletsSheet
          open={manageOpen}
          onOpenChange={setManageOpen}
          wallets={wallets}
          recoveryFlags={recoveryFlags}
          onSelect={(id) => void setActive(id)}
          onAdd={() => {
            resetAddDialog();
            setAddOpen(true);
          }}
          onRename={(w) => {
            setRenameId(w.id);
            setRenameValue(w.name);
          }}
          onCopy={(w) => {
            void copyToClipboardRobust(w.address).then(
              () => toast.success("Address copied"),
              () => toast.error("Copy failed"),
            );
          }}
          onRemove={(w) => setConfirmDeleteId(w.id)}
        />

        <CurrencyPickerSheet
          open={currencyOpen}
          onOpenChange={setCurrencyOpen}
          value={(prefs?.currency || displayCurrency || "USD") as CurrencyCode}
          onSelect={(code) => {
            setDisplayCurrency(code);
            void updatePref({ currency: code });
          }}
        />

        <LanguagePickerSheet
          open={languageOpen}
          onOpenChange={setLanguageOpen}
          value={prefs?.language || displayLanguage || "en"}
          onSelect={(code) => {
            setDisplayLanguage(code);
            void updatePref({ language: code });
            toast.success(t("language.updated"));
          }}
        />

        <Dialog
          open={addOpen}
          onOpenChange={(o) => {
            setAddOpen(o);
            if (!o) resetAddDialog();
          }}
        >
          <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle>Add wallet</DialogTitle>
              <DialogDescription>
                Create a new OpenPay Pro wallet or restore one with your recovery phrase.
              </DialogDescription>
            </DialogHeader>
            <Tabs value={addTab} onValueChange={(v) => setAddTab(v as "create" | "import")}>
              <TabsList className="grid w-full grid-cols-2 rounded-full">
                <TabsTrigger value="create" className="rounded-full">
                  Create
                </TabsTrigger>
                <TabsTrigger value="import" className="rounded-full">
                  Import
                </TabsTrigger>
              </TabsList>
              <TabsContent value="create" className="mt-4 space-y-3">
                <div>
                  <Label>Wallet name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Main Wallet"
                    className="mt-1.5"
                    maxLength={40}
                  />
                </div>
                {!mnemonic ? (
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
                    Create wallet
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
                      <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Safety — save this phrase offline
                      </div>
                      <ul className="list-disc space-y-1 pl-4">
                        <li>
                          Anyone with these words can restore this exact OpenPay Pro wallet and its
                          balances.
                        </li>
                        <li>Never share them. OpenPay staff will never ask for your phrase.</li>
                        <li>Store offline — screenshot or cloud notes are risky.</li>
                      </ul>
                      {createdAddress && (
                        <p className="mt-2 font-mono text-[11px] opacity-90">
                          Address: {shortAddress(createdAddress, 8, 6)}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                      {mnemonic.map((w, i) => (
                        <div
                          key={`${w}-${i}`}
                          className="rounded-xl border border-border/60 bg-muted/40 px-2 py-1.5"
                        >
                          <span className="text-muted-foreground">{i + 1}.</span> {w}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-full"
                        onClick={() => {
                          void copyToClipboardRobust(mnemonic.join(" ")).then(
                            () => toast.success("Phrase copied"),
                            () => toast.error("Copy failed"),
                          );
                        }}
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 rounded-full bg-primary text-primary-foreground"
                        onClick={async () => {
                          await updatePref({ recovery_backed_up: true });
                          toast.success("You're all set");
                          setAddOpen(false);
                          resetAddDialog();
                        }}
                      >
                        I've saved it
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="import" className="mt-4 space-y-3">
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
                  <div className="mb-1 flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Safety
                  </div>
                  Only paste a phrase you trust. Import restores that exact OpenPay Pro wallet
                  address, OUSD / Pi balances, and token holdings.
                </div>
                <div>
                  <Label>Wallet name (optional)</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Imported wallet"
                    className="mt-1.5"
                    maxLength={40}
                  />
                </div>
                <div>
                  <Label>12-word recovery phrase</Label>
                  <Textarea
                    value={importPhrase}
                    onChange={(e) => setImportPhrase(e.target.value)}
                    placeholder="word1 word2 word3 …"
                    className="mt-1.5 min-h-[88px] rounded-2xl font-mono text-sm"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <Label>OpenPay Pro address (optional check)</Label>
                  <Input
                    value={importAddress}
                    onChange={(e) => setImportAddress(e.target.value)}
                    placeholder="0x… or your OpenPay address"
                    className="mt-1.5 font-mono text-sm"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Phrase alone restores the exact ledger. Address-only switches a wallet you
                    already own.
                  </p>
                </div>
                <Button
                  onClick={importWallet}
                  disabled={creating || !importPhrase.trim()}
                  className="w-full rounded-2xl bg-primary text-primary-foreground"
                >
                  {creating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}{" "}
                  Import wallet
                </Button>
                {importAddress.trim() && !importPhrase.trim() && (
                  <Button
                    variant="outline"
                    onClick={importByAddressOnly}
                    className="w-full rounded-2xl"
                  >
                    Switch to this address
                  </Button>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </section>

      <Dialog open={!!renameId} onOpenChange={(o) => !o && setRenameId(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Rename wallet</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={40}
            placeholder="Wallet name"
          />
          <DialogFooter>
            <Button
              className="rounded-full bg-primary text-primary-foreground"
              onClick={renameWallet}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Remove wallet?</DialogTitle>
            <DialogDescription>
              This removes the wallet from this account. If it has a recovery phrase backed up, you
              can import it again later to restore the same address and balances.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setConfirmDeleteId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={() => confirmDeleteId && removeWallet(confirmDeleteId)}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Security */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("settings.security")}
        </h2>
        <div className="overflow-hidden rounded-2xl bg-card p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <BiometricCard
              enabled={!!prefs?.biometric_enabled}
              onToggle={(v) => updatePref({ biometric_enabled: v })}
            />
            <LockPasswordCard
              hasPin={!!prefs?.pin_set}
              onSave={async (password) => {
                const h = await hashLockPassword(user.id, password);
                await updatePref({ pin_hash: h });
                rememberLockEnabled(user.id, true);
                // Require unlock before dashboard / wallet access
                clearSessionUnlock(user.id);
                notifyLockPasswordChanged();
                toast.success("App lock enabled — enter your password to continue");
                requestWalletLock();
              }}
              onClear={async () => {
                await updatePref({ pin_hash: null });
                rememberLockEnabled(user.id, false);
                clearSessionUnlock(user.id);
                notifyLockPasswordChanged();
                toast.success("App lock turned off");
              }}
              onLockNow={() => requestWalletLock()}
            />
            <RecoveryCard
              wallets={wallets}
              recoveryFlags={recoveryFlags}
              backedUp={!!prefs?.recovery_backed_up}
              onConfirm={async () => {
                await updatePref({ recovery_backed_up: true });
                toast.success("Marked as backed up");
              }}
              onAttached={() => {
                qc.invalidateQueries({ queryKey: ["wallet-recovery-flags", user.id] });
              }}
            />
          </div>
        </div>
      </section>

      {/* Preferences */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("settings.preferences")}
        </h2>
        <div className="overflow-hidden rounded-2xl bg-card p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <SettingRow label={t("settings.theme")} desc={t("settings.themeDesc")}>
              <div className="inline-flex rounded-full border border-border bg-card p-1">
                {(["light", "dark"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setTheme(mode);
                      updatePref({ theme: mode });
                    }}
                    className={`rounded-full px-3 py-1 text-xs capitalize ${theme === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    {mode === "light" ? t("settings.light") : t("settings.dark")}
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow label={t("settings.currency")} desc={t("settings.currencyDesc")}>
              <button
                type="button"
                onClick={() => setCurrencyOpen(true)}
                className="flex h-9 max-w-[14rem] items-center gap-2 rounded-full border border-border bg-background px-3 text-left text-sm font-medium press"
              >
                <span className="truncate">
                  {currencyListLabel(getCurrencyMeta(prefs?.currency || displayCurrency || "USD"))}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </SettingRow>
            <SettingRow label={t("settings.language")} desc={t("settings.languageDesc")}>
              <button
                type="button"
                onClick={() => setLanguageOpen(true)}
                className="flex h-9 max-w-[14rem] items-center gap-2 rounded-full border border-border bg-background px-3 text-left text-sm font-medium press"
              >
                <span className="truncate">
                  {getLanguageMeta(prefs?.language || displayLanguage || "en").nativeName}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </SettingRow>
            <SettingRow label={t("settings.priceAlerts")} desc={t("settings.priceAlertsDesc")}>
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
            <SettingRow label={t("settings.txAlerts")} desc={t("settings.txAlertsDesc")}>
              <Switch
                checked={
                  (prefs?.notifications as Record<string, boolean> | null)?.tx_alerts ?? true
                }
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
            <SettingRow
              label={t("settings.lockPush")}
              desc={t("settings.lockPushDesc")}
            >
              <Switch
                checked={
                  (prefs?.notifications as Record<string, boolean> | null)?.browser_push ?? false
                }
                onCheckedChange={async (v) => {
                  if (v) {
                    const { syncPushSubscription } = await import("@/lib/push-client");
                    const status = await syncPushSubscription(true);
                    if (status === "denied") {
                      toast.error("Notification permission denied");
                      return;
                    }
                    if (status === "unsupported") {
                      toast.error(
                        "Push not supported on this device — install to Home Screen on iOS",
                      );
                      return;
                    }
                    if (status === "error") {
                      toast.error("Could not enable lock-screen push");
                      return;
                    }
                    toast.success("Lock-screen notifications enabled");
                  } else {
                    const { syncPushSubscription } = await import("@/lib/push-client");
                    await syncPushSubscription(false);
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
            <SettingRow
              label={t("settings.emailAlerts")}
              desc={t("settings.emailAlertsDesc")}
            >
              <Switch
                checked={
                  (prefs?.notifications as Record<string, boolean> | null)?.email_alerts ?? true
                }
                onCheckedChange={(v) =>
                  updatePref({
                    notifications: {
                      ...((prefs?.notifications as Record<string, boolean> | null) ?? {}),
                      email_alerts: v,
                    },
                  })
                }
              />
            </SettingRow>
          </div>
        </div>
      </section>

      {/* Connected */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("settings.connected")}
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

      {/* Legal */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("settings.legal")}
        </h2>
        <ul className="overflow-hidden rounded-2xl bg-card">
          <li className="border-b border-border/60">
            <a
              href="/openusd"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left press hover:bg-muted/40"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-foreground">
                <CircleDollarSign className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">Meet OpenUSD</span>
                <span className="block text-xs text-muted-foreground">
                  OpenPay’s network dollar — OUSD
                </span>
              </span>
              <span className="text-muted-foreground">›</span>
            </a>
          </li>
          <li className="border-b border-border/60">
            <Link
              to="/about"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left press hover:bg-muted/40"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-foreground">
                <BookOpen className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">About OpenPay Pro</span>
                <span className="block text-xs text-muted-foreground">
                  An open network for wallets, APIs, and agents
                </span>
              </span>
              <span className="text-muted-foreground">›</span>
            </Link>
          </li>
          <li className="border-b border-border/60">
            <Link
              to="/terms"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left press hover:bg-muted/40"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-foreground">
                <FileText className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  Terms of Service
                </span>
                <span className="block text-xs text-muted-foreground">
                  Rules for using OpenPay Pro
                </span>
              </span>
              <span className="text-muted-foreground">›</span>
            </Link>
          </li>
          <li className="border-b border-border/60">
            <Link
              to="/privacy"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left press hover:bg-muted/40"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-foreground">
                <Shield className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">Privacy Policy</span>
                <span className="block text-xs text-muted-foreground">How we handle your data</span>
              </span>
              <span className="text-muted-foreground">›</span>
            </Link>
          </li>
          <li className="border-b border-border/60">
            <Link
              to="/regulatory"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left press hover:bg-muted/40"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-foreground">
                <ShieldCheck className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  Regulatory Status
                </span>
                <span className="block text-xs text-muted-foreground">
                  Safety disclosures &amp; third-party providers
                </span>
              </span>
              <span className="text-muted-foreground">›</span>
            </Link>
          </li>
          <li>
            <Link
              to="/legal"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left press hover:bg-muted/40"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-foreground">
                <FileText className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">Software License</span>
                <span className="block text-xs text-muted-foreground">
                  MRWAIN ORGANIZATION · Pi Network license
                </span>
              </span>
              <span className="text-muted-foreground">›</span>
            </Link>
          </li>
        </ul>
      </section>

      {/* Account */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("settings.account")}
        </h2>
        <ul className="overflow-hidden rounded-2xl bg-card">
          <PhantomSettingsRows />
          <li>
            <button
              type="button"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                try {
                  await supabase.auth.signOut();
                  qc.clear();
                  toast.success("Signed out");
                  await router.navigate({ to: "/authpi", replace: true });
                } catch (err) {
                  toast.error((err as Error).message || "Could not sign out");
                  setSigningOut(false);
                }
              }}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left press hover:bg-muted/40 disabled:opacity-60"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
                {signingOut ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <LogOut className="h-4.5 w-4.5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-destructive">Sign out</span>
                <span className="block text-xs text-muted-foreground">
                  Log out of this account on this device
                </span>
              </span>
            </button>
          </li>
        </ul>
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
      stashOpenPayConnectReturn("/settings");
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
          <p className="mt-2 text-xs text-muted-foreground">
            Partner app keys (client ID, <code>opk_live_…</code>, redirect URIs) are managed in the{" "}
            <a
              href={OPENPAY_PARTNER_PORTAL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:underline"
            >
              OpenPay partner portal
            </a>
            .
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

function LockPasswordCard({
  hasPin,
  onSave,
  onClear,
  onLockNow,
}: {
  hasPin: boolean;
  onSave: (password: string) => Promise<void>;
  onClear: () => Promise<void>;
  onLockNow: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    const invalid = validateLockPassword(password);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    if (password !== password2) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await onSave(password);
      setOpen(false);
      setPassword("");
      setPassword2("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save lock password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Lock className="h-4 w-4" />
      </span>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Enable app lock</div>
          <div className="text-xs text-muted-foreground">
            Require password before opening your dashboard
          </div>
        </div>
        <Switch
          checked={hasPin}
          onCheckedChange={(on) => {
            if (on) setOpen(true);
            else void onClear();
          }}
          aria-label="Enable app lock"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
              setPassword("");
              setPassword2("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="flex-1 rounded-full">
              {hasPin ? "Change password" : "Set password"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>{hasPin ? "Change lock password" : "Enable app lock"}</DialogTitle>
              <DialogDescription>
                At least 6 characters. You’ll need this password every time you open the dashboard.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
              />
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setShow((v) => !v)}
              >
                {show ? "Hide passwords" : "Show passwords"}
              </button>
            </div>
            <DialogFooter>
              <Button
                onClick={() => void save()}
                disabled={busy}
                className="rounded-full bg-[#AB9FF2] font-bold text-black hover:bg-[#B8B0FF]"
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {hasPin ? "Save password" : "Enable lock"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {hasPin ? (
          <Button size="sm" variant="secondary" className="rounded-full" onClick={onLockNow}>
            Lock now
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function RecoveryCard({
  wallets,
  recoveryFlags,
  backedUp,
  onConfirm,
  onAttached,
}: {
  wallets: SettingsWallet[];
  recoveryFlags: Record<string, boolean>;
  backedUp: boolean;
  onConfirm: () => Promise<void>;
  onAttached: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"reveal" | "attach" | "missing">("missing");
  const active = wallets.find((w) => w.is_active) ?? wallets[0];

  async function openBackup() {
    if (!active) {
      toast.error("No wallet to back up");
      return;
    }
    const sessionPhrase = peekRecoveryPhrase(active.id);
    if (sessionPhrase) {
      setPhrase(sessionPhrase.split(" "));
      setMode("reveal");
      setOpen(true);
      return;
    }
    if (recoveryFlags[active.id]) {
      setPhrase(null);
      setMode("missing");
      setOpen(true);
      return;
    }
    // Legacy wallet — generate phrase once and attach without changing address/balances
    setBusy(true);
    try {
      const words = generateMnemonic(12);
      const hash = await recoveryHashFromPhrase(words);
      const { error } = await supabase.rpc("attach_wallet_recovery", {
        p_wallet_id: active.id,
        p_recovery_hash: hash,
      });
      if (error) throw error;
      stashRecoveryPhrase(active.id, words.join(" "));
      setPhrase(words);
      setMode("attach");
      setOpen(true);
      onAttached();
      toast.success("Recovery phrase linked to this wallet");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
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
      <div className="text-xs text-muted-foreground">
        Backup the active wallet so you can import the exact address later
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full rounded-full"
          onClick={openBackup}
          disabled={busy}
        >
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {active && recoveryFlags[active.id] ? "View backup status" : "Back up phrase"}
        </Button>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              {mode === "missing" ? "Phrase already backed up" : "Your recovery phrase"}
            </DialogTitle>
            <DialogDescription>
              {mode === "missing"
                ? "For security, OpenPay Pro never stores your words. Use the phrase you saved when you created or backed up this wallet to import it again."
                : "Write these 12 words down and store offline. Anyone with these words can restore this exact OpenPay Pro wallet and its balances. Never share them."}
            </DialogDescription>
          </DialogHeader>
          {phrase && (
            <>
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-100">
                <div className="mb-1 flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Safety
                </div>
                Screenshot and cloud notes are risky. Prefer paper stored offline.
                {active && (
                  <p className="mt-1 font-mono opacity-90">{shortAddress(active.address, 8, 6)}</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                {phrase.map((w, i) => (
                  <div
                    key={`${w}-${i}`}
                    className="rounded-md border border-border/60 bg-card px-2 py-1.5"
                  >
                    {i + 1}. {w}
                  </div>
                ))}
              </div>
            </>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {phrase && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  void copyToClipboardRobust(phrase.join(" ")).then(
                    () => toast.success("Copied"),
                    () => toast.error("Copy failed"),
                  );
                }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy
              </Button>
            )}
            <Button
              className="rounded-full bg-primary text-primary-foreground"
              onClick={async () => {
                await onConfirm();
                setOpen(false);
              }}
            >
              {mode === "missing" ? "Got it" : "I've backed it up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
