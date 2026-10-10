import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Unplug, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/wallet/PageHeader";
// Type-only imports: the MetaMask SDKs are browser-only and crash the server
// bundle if statically imported (routeTree imports every route for SSR).
import type { MetamaskSolanaClient } from "@/lib/metamask-solana";
import type {
  MetamaskMultichainClient,
  SessionData,
} from "@/lib/metamask-multichain";

const loadSolana = () => import("@/lib/metamask-solana");
const loadMultichain = () => import("@/lib/metamask-multichain");
type MultichainModule = Awaited<ReturnType<typeof loadMultichain>>;

function shortSolAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/metamask")({
  ssr: false,
  head: () => ({ meta: [{ title: "MetaMask — OpenPay Pro" }] }),
  component: MetamaskConnectPage,
});

type Tab = "solana" | "multichain";

function MetamaskConnectPage() {
  const [tab, setTab] = useState<Tab>("solana");

  return (
    <div className="ot-phantom mx-auto max-w-lg animate-page-in space-y-5 pb-28 pt-1">
      <PageHeader title="MetaMask" backTo="/dashboard" />

      <div className="rounded-3xl bg-card p-4">
        <div className="mb-1 text-xs font-medium text-muted-foreground">MetaMask Connect</div>
        <p className="text-xs text-muted-foreground">
          Connect Solana via Wallet Standard, or open a multichain session (EVM + Solana).
        </p>
        <a
          href="https://docs.metamask.io/metamask-connect/solana/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary"
        >
          Solana docs
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="flex gap-1 rounded-full bg-muted/60 p-1">
        {(
          [
            { id: "solana" as const, label: "Solana" },
            { id: "multichain" as const, label: "Multichain" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-semibold press",
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "solana" ? <SolanaConnectPanel /> : <MultichainConnectPanel />}
    </div>
  );
}

function SolanaConnectPanel() {
  const [client, setClient] = useState<MetamaskSolanaClient | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const { getMetamaskSolanaClient } = await loadSolana();
        const c = await getMetamaskSolanaClient();
        if (!mounted) return;
        setClient(c);
        try {
          const wallet = c.getWallet();
          const accounts = wallet.accounts ?? [];
          if (accounts[0]?.address) setAccount(String(accounts[0].address));
        } catch {
          /* no prior accounts */
        }
      } catch (err) {
        const msg = (err as Error).message || "Could not init MetaMask Solana";
        if (mounted) setInitError(msg);
        toast.error(msg);
      }
    }
    void init();
    return () => {
      mounted = false;
    };
  }, []);

  const handleConnect = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const wallet = client.getWallet();
      const connectFeature = wallet.features["standard:connect"] as
        | { connect: () => Promise<{ accounts: Array<{ address: string }> }> }
        | undefined;
      if (!connectFeature?.connect) {
        throw new Error("MetaMask wallet does not support standard:connect");
      }
      const { accounts } = await connectFeature.connect();
      const address = accounts[0]?.address;
      if (!address) throw new Error("No Solana account returned");
      setAccount(address);
      toast.success("MetaMask Solana connected");
    } catch (error) {
      toast.error((error as Error).message || "Connection failed");
    } finally {
      setLoading(false);
    }
  }, [client]);

  const handleDisconnect = useCallback(async () => {
    if (!client) return;
    setDisconnecting(true);
    try {
      await client.disconnect();
      setAccount(null);
      toast.success("Disconnected");
    } catch (error) {
      toast.error((error as Error).message || "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  }, [client]);

  return (
    <div className="rounded-3xl bg-card p-4 space-y-4">
      {initError ? (
        <p className="text-sm text-destructive">{initError}</p>
      ) : !client ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparing MetaMask Solana…
        </div>
      ) : !account ? (
        <Button
          type="button"
          className="h-12 w-full rounded-full font-semibold"
          disabled={loading || !client}
          onClick={() => void handleConnect()}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wallet className="mr-2 h-4 w-4" />
          )}
          {loading ? "Connecting…" : "Connect MetaMask"}
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-muted/50 px-3 py-3">
            <div className="text-xs font-medium text-muted-foreground">Connected</div>
            <div className="mt-1 truncate font-mono text-sm font-semibold" title={account}>
              {shortSolAddress(account)}
            </div>
            <div className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
              {account}
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-11 w-full rounded-full font-semibold"
            disabled={disconnecting}
            onClick={() => void handleDisconnect()}
          >
            {disconnecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Unplug className="mr-2 h-4 w-4" />
            )}
            Disconnect
          </Button>
        </div>
      )}
      {!import.meta.env.VITE_INFURA_API_KEY ? (
        <p className="text-[11px] text-muted-foreground">
          Using public Solana RPCs. Set <span className="font-mono">VITE_INFURA_API_KEY</span> for
          Infura endpoints.
        </p>
      ) : null}
    </div>
  );
}

function MultichainConnectPanel() {
  const [client, setClient] = useState<MetamaskMultichainClient | null>(null);
  const [mm, setMm] = useState<MultichainModule | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [ready, setReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const mod = await loadMultichain();
        const c = await mod.getMetamaskMultichainClient();
        if (!mounted) return;
        setMm(mod);
        setClient(c);
        c.on("wallet_sessionChanged", (s) => {
          if (mounted) setSession(s ?? null);
        });
        try {
          const existing = await c.provider.getSession();
          if (mounted && existing) setSession(existing);
        } catch {
          /* no prior session */
        }
      } catch (err) {
        toast.error((err as Error).message || "Could not init MetaMask Multichain");
      } finally {
        if (mounted) setReady(true);
      }
    }
    void init();
    return () => {
      mounted = false;
    };
  }, []);

  const handleConnect = useCallback(async () => {
    if (!client || !mm) return;
    setConnecting(true);
    try {
      await client.connect([...mm.MM_DEFAULT_SCOPES], []);
      const s = await client.provider.getSession();
      setSession(s ?? null);
      toast.success("MetaMask connected (EVM + Solana)");
    } catch (err) {
      toast.error((err as Error).message || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, [client, mm]);

  const handleDisconnect = useCallback(async () => {
    if (!client) return;
    setDisconnecting(true);
    try {
      await client.disconnect();
      setSession(null);
      toast.success("Disconnected from MetaMask");
    } catch (err) {
      toast.error((err as Error).message || "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  }, [client]);

  const scopes = mm ? mm.sessionScopeKeys(session) : [];
  const isConnected = scopes.length > 0;

  return (
    <div className="rounded-3xl bg-card p-4 space-y-4">
      {!ready ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparing MetaMask…
        </div>
      ) : !isConnected ? (
        <Button
          type="button"
          className="h-12 w-full rounded-full font-semibold"
          disabled={connecting || !client}
          onClick={() => void handleConnect()}
        >
          {connecting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wallet className="mr-2 h-4 w-4" />
          )}
          {connecting ? "Connecting…" : "Connect (EVM + Solana)"}
        </Button>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-semibold">Connected scopes</div>
            <ul className="space-y-2">
              {scopes.map((scope) => {
                const accounts = mm ? mm.accountsInScope(session, scope) : [];
                return (
                  <li key={scope} className="rounded-2xl bg-muted/50 px-3 py-2.5">
                    <div className="font-mono text-[11px] font-semibold text-foreground">
                      {scope}
                    </div>
                    {accounts.length > 0 ? (
                      <div className="mt-1 space-y-0.5">
                        {accounts.map((a) => (
                          <div
                            key={a}
                            className="truncate font-mono text-[10px] text-muted-foreground"
                            title={a}
                          >
                            {shortCaipAccount(a)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 text-[10px] text-muted-foreground">No accounts</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-11 w-full rounded-full font-semibold"
            disabled={disconnecting}
            onClick={() => void handleDisconnect()}
          >
            {disconnecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Unplug className="mr-2 h-4 w-4" />
            )}
            Disconnect
          </Button>
        </div>
      )}
    </div>
  );
}
