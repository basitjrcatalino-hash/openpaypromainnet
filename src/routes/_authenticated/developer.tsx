import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AppWindow,
  BookOpen,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  ShieldAlert,
  Unplug,
  Wallet,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { copyText } from "@/lib/clipboard";
import {
  activateDeveloperApiKey,
  createDeveloperApiKey,
  getDeveloperPortalProfile,
  listDeveloperApiKeys,
  revokeDeveloperApiKey,
} from "@/lib/developer.functions";
import { listProApps, listProConnections, revokeProConnection } from "@/lib/pro-connect.functions";
import {
  generateMnemonic,
  peekRecoveryPhrase,
  recoveryHashFromPhrase,
  stashRecoveryPhrase,
} from "@/lib/wallet-utils";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function buildDemoNote(handle: string) {
  const h = handle.trim().replace(/^@+/, "");
  const r = "r_demo";
  if (/^0x[a-f0-9]{40}$/i.test(h) || /^uid_/i.test(h)) return `pro_xfer:${h}:${r}`;
  return `pro_xfer:@${h}:${r}`;
}

export const Route = createFileRoute("/_authenticated/developer")({
  head: () => ({
    meta: [
      { title: "Developer Portal — OpenPay Pro" },
      {
        name: "description",
        content: "API keys, wallet seed, and receive-payment integration for OpenPay Pro wallets.",
      },
    ],
  }),
  component: DeveloperPortalPage,
});

function copy(label: string, value: string) {
  void copyText(value).then(
    () => toast.success(`${label} copied`),
    () => toast.error("Copy failed"),
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-border/50 bg-muted/40 p-3 text-[11px] leading-relaxed text-foreground sm:text-xs">
      <code>{children}</code>
    </pre>
  );
}

function DeveloperPortalPage() {
  const qc = useQueryClient();
  const getProfile = useServerFn(getDeveloperPortalProfile);
  const listKeys = useServerFn(listDeveloperApiKeys);
  const createKeyFn = useServerFn(createDeveloperApiKey);
  const revokeKeyFn = useServerFn(revokeDeveloperApiKey);
  const activateKeyFn = useServerFn(activateDeveloperApiKey);

  const profileQ = useQuery({
    queryKey: ["developer-portal-profile"],
    queryFn: () => getProfile(),
  });
  const keysQ = useQuery({
    queryKey: ["developer-api-keys"],
    queryFn: () => listKeys(),
  });

  const [keyLabel, setKeyLabel] = useState("My app");
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [showPhrase, setShowPhrase] = useState(false);
  const [phraseWords, setPhraseWords] = useState<string[] | null>(null);
  const [phraseBusy, setPhraseBusy] = useState(false);

  const listApps = useServerFn(listProApps);
  const listConnections = useServerFn(listProConnections);
  const revokeConnectionFn = useServerFn(revokeProConnection);

  const appsQ = useQuery({
    queryKey: ["pro-connect-apps"],
    queryFn: () => listApps(),
  });
  const connectionsQ = useQuery({
    queryKey: ["pro-connect-connections"],
    queryFn: () => listConnections(),
  });

  const profile = profileQ.data;
  const wallet = profile?.activeWallet;
  const username = profile?.username;
  const address = wallet?.address ?? "";

  const receiveHandle = useMemo(() => {
    if (address) return address;
    if (username) return `@${username.replace(/^@+/, "")}`;
    if (profile?.userId) return `uid_${profile.userId}`;
    return "";
  }, [address, username, profile?.userId]);

  const sampleNote = useMemo(
    () => (receiveHandle ? buildDemoNote(receiveHandle) : "pro_xfer:@you:r_demo"),
    [receiveHandle],
  );

  const createKey = useMutation({
    mutationFn: () => createKeyFn({ data: { label: keyLabel || "My app" } }),
    onSuccess: (res) => {
      setPlainKey(res.plaintext);
      void qc.invalidateQueries({ queryKey: ["developer-api-keys"] });
      toast.success("API key created — copy it now");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeKey = useMutation({
    mutationFn: (id: string) => revokeKeyFn({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["developer-api-keys"] });
      toast.success("Key revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activateKey = useMutation({
    mutationFn: (id: string) => activateKeyFn({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["developer-api-keys"] });
      toast.success("Key activated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeConnection = useMutation({
    mutationFn: (id: string) => revokeConnectionFn({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pro-connect-connections"] });
      toast.success("Access revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function revealOrAttachSeed() {
    if (!wallet) {
      toast.error("Create a wallet first");
      return;
    }
    setPhraseBusy(true);
    try {
      const session = peekRecoveryPhrase(wallet.id);
      if (session) {
        setPhraseWords(session.split(/\s+/));
        setShowPhrase(true);
        return;
      }
      const has = profile?.recovery?.[wallet.id];
      if (has) {
        setPhraseWords(null);
        setShowPhrase(true);
        toast.message("Phrase already backed up offline — OpenPay Pro never stores the words.");
        return;
      }
      const words = generateMnemonic(12);
      const hash = await recoveryHashFromPhrase(words);
      const { error } = await supabase.rpc("attach_wallet_recovery", {
        p_wallet_id: wallet.id,
        p_recovery_hash: hash,
      });
      if (error) throw error;
      stashRecoveryPhrase(wallet.id, words.join(" "));
      setPhraseWords(words);
      setShowPhrase(true);
      void qc.invalidateQueries({ queryKey: ["developer-portal-profile"] });
      toast.success("Wallet seed linked — save it offline");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPhraseBusy(false);
    }
  }

  if (profileQ.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const inboundUrl = profile?.inboundUrl ?? "https://openpaypro.space/api/public/openpay/inbound";
  const curlSample = `curl -X POST "${inboundUrl}" \\
  -H "Authorization: Bearer opdk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "${receiveHandle || "0x…"}",
    "amount": 25.00,
    "openpay_tx_id": "UNIQUE_TX_ID",
    "note": "${sampleNote}"
  }'`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-24">
      <div className="space-y-2">
        <Badge variant="secondary" className="rounded-full">
          Developer Portal
        </Badge>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Integrate OpenPay Pro
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Create API keys, back up your wallet seed, and receive OUSD to your Pro wallet address —
          the same rails partners use for deposit / credit integrations.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/partner-api">
              <AppWindow className="mr-1.5 h-3.5 w-3.5" />
              Partner API
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/docs/integrations">
              <BookOpen className="mr-1.5 h-3.5 w-3.5" />
              Connect docs
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/docs/exchange">Exchange guide</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/connect">Agent Connect</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/settings">Settings</Link>
          </Button>
        </div>
      </div>

      {/* Wallet identity */}
      <section className="space-y-3 rounded-3xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold">Receive identity</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Partners credit this wallet via inbound API. Prefer your{" "}
          <strong className="text-foreground">0x address</strong> in{" "}
          <code className="rounded bg-muted px-1">pro_xfer</code> notes.
        </p>
        {!wallet ? (
          <p className="text-sm text-amber-600">
            No wallet yet — create one in Settings or Dashboard.
          </p>
        ) : (
          <div className="space-y-2">
            <FieldRow
              label="Wallet address"
              value={address}
              onCopy={() => copy("Address", address)}
            />
            <FieldRow
              label="Username"
              value={username ? `@${username.replace(/^@+/, "")}` : "— set in Settings"}
              onCopy={
                username ? () => copy("Username", `@${username.replace(/^@+/, "")}`) : undefined
              }
            />
            <FieldRow
              label="User id"
              value={profile?.userId ? `uid_${profile.userId}` : "—"}
              onCopy={profile?.userId ? () => copy("User id", `uid_${profile.userId}`) : undefined}
            />
            <FieldRow
              label="Routing note"
              value={sampleNote}
              onCopy={() => copy("Note", sampleNote)}
            />
          </div>
        )}
        <Button asChild className="rounded-full" size="sm">
          <Link to="/receive">Open Receive</Link>
        </Button>
      </section>

      {/* Wallet seed */}
      <section className="space-y-3 rounded-3xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          <h2 className="text-base font-bold">Wallet seed (recovery phrase)</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Each Pro account wallet has a 12-word seed used to restore the same address and balances.
          Use it to reconnect this wallet on another device.{" "}
          <strong className="text-foreground">Never send the seed to an API or third party</strong>{" "}
          — use an <code className="rounded bg-muted px-1">opdk_</code> API key for integrations.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="rounded-full"
            disabled={phraseBusy || !wallet}
            onClick={() => void revealOrAttachSeed()}
          >
            {phraseBusy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : showPhrase && phraseWords ? (
              <EyeOff className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Eye className="mr-1.5 h-3.5 w-3.5" />
            )}
            {wallet && profile?.recovery?.[wallet.id]
              ? "View seed status"
              : "Generate / reveal seed"}
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/settings">Manage in Settings</Link>
          </Button>
        </div>
        {showPhrase ? (
          phraseWords ? (
            <div className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-3">
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                Write these words down offline. Anyone with them controls this wallet.
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {phraseWords.map((w, i) => (
                  <span
                    key={`${w}-${i}`}
                    className="rounded-lg bg-background/80 px-2 py-1.5 text-[12px] font-semibold tabular-nums"
                  >
                    <span className="mr-1 text-muted-foreground">{i + 1}.</span>
                    {w}
                  </span>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => copy("Seed", phraseWords.join(" "))}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy phrase
              </Button>
            </div>
          ) : (
            <p className="rounded-2xl border border-border/50 bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
              This wallet already has a recovery hash on file. The plaintext seed is not stored on
              OpenPay Pro servers — use the phrase you saved when you created or backed up the
              wallet.
            </p>
          )
        ) : null}
      </section>

      {/* API keys */}
      <section className="space-y-3 rounded-3xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold">Developer API keys</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Keys start with <code className="rounded bg-muted px-1">opdk_</code>. Use them as{" "}
          <code className="rounded bg-muted px-1">Authorization: Bearer</code> on inbound receive.
          Each key can only credit <strong className="text-foreground">your</strong> Pro wallet.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyLabel}
            onChange={(e) => setKeyLabel(e.target.value)}
            placeholder="Label (e.g. Production bot)"
            className="h-10 max-w-xs rounded-xl"
          />
          <Button
            className="rounded-full"
            disabled={createKey.isPending}
            onClick={() => createKey.mutate()}
          >
            {createKey.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-4 w-4" />
            )}
            Create key
          </Button>
        </div>

        <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50">
          {(keysQ.data ?? []).length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No keys yet. Create one to start receiving via API.
            </p>
          ) : (
            (keysQ.data ?? []).map((k) => (
              <div key={k.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{k.label}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {k.prefix}… · {(k.scopes ?? []).join(", ")}
                  </p>
                </div>
                <Badge
                  variant={k.active ? "secondary" : "outline"}
                  className={cn("rounded-full", !k.active && "opacity-60")}
                >
                  {k.active ? "Active" : "Revoked"}
                </Badge>
                {k.active ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={revokeKey.isPending}
                    onClick={() => revokeKey.mutate(k.id)}
                  >
                    Revoke
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={activateKey.isPending}
                    onClick={() => activateKey.mutate(k.id)}
                  >
                    Activate
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Pro Connect apps — full portal at /partner-api */}
      <section className="space-y-3 rounded-3xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2">
          <AppWindow className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold">Pro Connect apps</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Register apps with client ID, secret, and OAuth callbacks — same flow as OpenPay’s Partner
          portal. Manage credentials on the dedicated Partner API page.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="rounded-full">
            <Link to="/partner-api">
              <Plus className="mr-1.5 h-4 w-4" />
              Open Partner API
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/docs/integrations">Docs</Link>
          </Button>
        </div>
        {(appsQ.data ?? []).length > 0 ? (
          <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50">
            {(appsQ.data ?? []).slice(0, 5).map((app) => (
              <div key={app.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{app.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{app.client_id}</p>
                </div>
                <Badge
                  variant={app.active ? "secondary" : "outline"}
                  className={cn("rounded-full", !app.active && "opacity-60")}
                >
                  {app.active ? "Active" : "Off"}
                </Badge>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* Connected apps (user as subject) */}
      <section className="space-y-3 rounded-3xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2">
          <Unplug className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold">Connected apps</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Apps you authorized via OpenPay Pro Auth. Revoke to invalidate their access tokens.
        </p>
        <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50">
          {(connectionsQ.data ?? []).length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No connected apps.
            </p>
          ) : (
            (connectionsQ.data ?? []).map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.app.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Scope: {c.scope}
                    {c.last_used_at
                      ? ` · last used ${new Date(c.last_used_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={revokeConnection.isPending}
                  onClick={() => revokeConnection.mutate(c.id)}
                >
                  Revoke
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Inbound snippet */}
      <section className="space-y-3 rounded-3xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold">Receive payments (inbound)</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          After an OpenPay user pays with a <code className="rounded bg-muted px-1">pro_xfer</code>{" "}
          note, your backend POSTs to the inbound endpoint with your developer key.
        </p>
        <FieldRow label="Endpoint" value={inboundUrl} onCopy={() => copy("Endpoint", inboundUrl)} />
        <CodeBlock>{curlSample}</CodeBlock>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => copy("cURL", curlSample)}
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Copy sample
        </Button>
      </section>

      <Dialog open={!!plainKey} onOpenChange={(o) => !o && setPlainKey(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Copy your API key</DialogTitle>
            <DialogDescription>
              This is the only time the full key is shown. Store it in your server secrets — OpenPay
              Pro only keeps a hash.
            </DialogDescription>
          </DialogHeader>
          <div className="break-all rounded-2xl border border-border bg-muted/40 p-3 font-mono text-xs">
            {plainKey}
          </div>
          <Button
            className="rounded-full"
            onClick={() => {
              if (plainKey) copy("API key", plainKey);
            }}
          >
            <Check className="mr-1.5 h-4 w-4" />
            Copy key
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldRow({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="break-all font-mono text-[12px] font-semibold">{value || "—"}</p>
      </div>
      {onCopy && value ? (
        <button
          type="button"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground press hover:bg-muted"
          onClick={onCopy}
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
