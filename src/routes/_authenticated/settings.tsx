import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Plus, Trash2, Check, Wallet as WalletIcon, KeyRound, ShieldCheck, Link2, Loader2, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/components/theme-provider";
import { generateAddress, generateMnemonic, shortAddress } from "@/lib/wallet-utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — OpenPay Pro Wallet" }] }),
  component: SettingsPage,
});

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
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", user.id).order("created_at", { ascending: true })).data ?? [],
  });

  const { data: prefs } = useQuery({
    queryKey: ["prefs", user.id],
    queryFn: async () => (await supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle()).data,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data,
  });
  const [username, setUsername] = useState<string>("");
  const [savingName, setSavingName] = useState(false);
  useEffect(() => {
    if (profile?.display_name && !username) setUsername(profile.display_name as string);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.display_name]);


  async function saveUsername() {
    const v = username.trim();
    if (!v) { toast.error("Username required"); return; }
    if (v.length > 40) { toast.error("Max 40 characters"); return; }
    setSavingName(true);
    try {
      const { error } = await supabase.from("profiles").upsert({ id: user.id, display_name: v, updated_at: new Date().toISOString() });
      if (error) throw error;
      toast.success("Username saved");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (err) { toast.error((err as Error).message); } finally { setSavingName(false); }
  }


  async function createWallet() {
    if (!newName.trim()) { toast.error("Name required"); return; }
    setCreating(true);
    try {
      const m = generateMnemonic();
      setMnemonic(m);
      await supabase.from("wallets").insert({ user_id: user.id, name: newName.trim(), address: generateAddress() });
      toast.success("Wallet created");
      setNewName("");
      qc.invalidateQueries({ queryKey: ["wallets", user.id] });
      qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
    } catch (err) { toast.error((err as Error).message); } finally { setCreating(false); }
  }

  async function importWallet() {
    if (importPhrase.trim().split(/\s+/).length < 12) { toast.error("Enter a 12-word phrase"); return; }
    setCreating(true);
    try {
      await supabase.from("wallets").insert({ user_id: user.id, name: "Imported wallet", address: generateAddress() });
      toast.success("Wallet imported");
      setImportPhrase("");
      qc.invalidateQueries({ queryKey: ["wallets", user.id] });
    } catch (err) { toast.error((err as Error).message); } finally { setCreating(false); }
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
    if (wallets.length <= 1) { toast.error("Keep at least one wallet"); return; }
    await supabase.from("wallets").delete().eq("id", id);
    toast.success("Wallet removed");
    qc.invalidateQueries({ queryKey: ["wallets", user.id] });
    qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
  }

  async function updatePref(patch: Record<string, any>) {
    await supabase.from("user_preferences").upsert({ user_id: user.id, ...patch, updated_at: new Date().toISOString() });
    qc.invalidateQueries({ queryKey: ["prefs", user.id] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">Wallets, security, preferences and OpenPay integration</p>
      </div>
      {/* Profile */}
      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Profile</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your display name" maxLength={40} className="mt-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">Shown on your dashboard greeting. Email: <span className="font-mono">{user.email}</span></p>
          </div>
          <Button onClick={saveUsername} disabled={savingName} className="rounded-full bg-gradient-primary text-primary-foreground">
            {savingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save
          </Button>
        </div>
      </Card>

      {/* Wallets */}

      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Wallets</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full bg-gradient-primary text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> Add wallet</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-3xl">
              <DialogHeader><DialogTitle>Add wallet</DialogTitle></DialogHeader>
              <Tabs defaultValue="create">
                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="create">Create</TabsTrigger><TabsTrigger value="import">Import</TabsTrigger></TabsList>
                <TabsContent value="create" className="mt-4 space-y-3">
                  <Label>Wallet name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Trading" />
                  <Button onClick={createWallet} disabled={creating} className="w-full rounded-2xl bg-gradient-primary text-primary-foreground">
                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WalletIcon className="mr-2 h-4 w-4" />} Generate wallet
                  </Button>
                  {mnemonic && (
                    <div className="rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs">
                      <div className="mb-2 font-semibold">⚠️ Save your recovery phrase</div>
                      <div className="grid grid-cols-3 gap-2 font-mono">
                        {mnemonic.map((w, i) => <div key={i} className="rounded-md bg-card px-2 py-1">{i + 1}. {w}</div>)}
                      </div>
                      <Button size="sm" variant="outline" className="mt-2 w-full rounded-full" onClick={() => { navigator.clipboard.writeText(mnemonic.join(" ")); toast.success("Phrase copied"); }}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy phrase
                      </Button>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="import" className="mt-4 space-y-3">
                  <Label>12-word recovery phrase</Label>
                  <Input value={importPhrase} onChange={(e) => setImportPhrase(e.target.value)} placeholder="abandon ability able …" />
                  <Button onClick={importWallet} disabled={creating} className="w-full rounded-2xl bg-gradient-primary text-primary-foreground">
                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />} Import
                  </Button>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
        <ul className="space-y-2">
          {wallets.map((w: any) => (
            <li key={w.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground"><WalletIcon className="h-4 w-4" /></span>
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {w.name}
                    {w.is_active && <span className="rounded-full bg-mint/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-mint-foreground">Active</span>}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">{shortAddress(w.address)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!w.is_active && <Button size="sm" variant="outline" className="rounded-full" onClick={() => setActive(w.id)}><Check className="mr-1 h-3.5 w-3.5" />Activate</Button>}
                <Button size="sm" variant="ghost" onClick={() => removeWallet(w.id)} aria-label="Remove"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Preferences */}
      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Appearance & preferences</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <SettingRow label="Theme" desc="Choose how OpenPay looks">
            <div className="inline-flex rounded-full border border-border bg-card p-1">
              {(["light", "dark"] as const).map((t) => (
                <button key={t} onClick={() => { setTheme(t); updatePref({ theme: t }); }}
                  className={`rounded-full px-3 py-1 text-xs capitalize ${theme === t ? "bg-gradient-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
              ))}
            </div>
          </SettingRow>
          <SettingRow label="Currency" desc="Display fiat values in">
            <select value={prefs?.currency ?? "USD"} onChange={(e) => updatePref({ currency: e.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option>
            </select>
          </SettingRow>
          <SettingRow label="Language" desc="Interface language">
            <select value={prefs?.language ?? "en"} onChange={(e) => updatePref({ language: e.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option>
            </select>
          </SettingRow>
          <SettingRow label="Price alerts" desc="Notify on big moves">
            <Switch
              checked={((prefs?.notifications as Record<string, boolean> | null)?.price_alerts) ?? true}
              onCheckedChange={(v) => updatePref({ notifications: { ...((prefs?.notifications as Record<string, boolean> | null) ?? {}), price_alerts: v } })}
            />
          </SettingRow>
        </div>
      </Card>

      {/* Security */}
      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Security</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <SecurityCard icon={ShieldCheck} title="Biometric login" desc="Use device biometrics to unlock" />
          <SecurityCard icon={KeyRound} title="PIN code" desc="Add a 6-digit PIN for transactions" />
          <SecurityCard icon={RefreshCw} title="Recovery phrase" desc="Backup your seed phrase" />
        </div>
      </Card>

      {/* OpenPay integration */}
      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground"><Link2 className="h-4 w-4" /></span>
          <div className="flex-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">OpenPay Integration</h2>
            <p className="mt-1 text-sm">Link your OpenPay account to auto-sync OUSD, transactions and merchant payments.</p>
          </div>
          <Button variant="outline" className="rounded-full" onClick={() => toast.info("OpenPay API integration is stubbed — wire up your endpoint in /src/lib/openpay.ts")}>
            Connect OpenPay
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SettingRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
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
function SecurityCard({ icon: Icon, title, desc }: { icon: typeof ShieldCheck; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground"><Icon className="h-4 w-4" /></span>
      <div className="mt-2 text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
      <Button size="sm" variant="outline" className="mt-3 w-full rounded-full">Configure</Button>
    </div>
  );
}
