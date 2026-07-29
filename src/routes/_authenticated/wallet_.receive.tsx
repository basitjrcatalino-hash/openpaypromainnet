/**
 * Receive — Phantom-style network picker + QR for OpenPay Pro ledger assets.
 * Route: /wallet/receive
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, Copy, Link2, Loader2, QrCode, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OusdIcon } from "@/components/ousd-icon";
import { supabase } from "@/integrations/supabase/client";
import { MAJOR_TOKENS } from "@/lib/major-tokens";
import { linkPiWallet } from "@/lib/pi-network";
import { OUSD_LOGO_URL, PI_NETWORK_LOGO_URL } from "@/lib/token-logos";
import { cn } from "@/lib/utils";
import { shortAddress } from "@/lib/wallet-utils";

const RECEIVE_NOTE_KEY = "openpay-receive-wallet-note-v1";

const searchSchema = z.object({
  network: z
    .enum(["openpay", "bitcoin", "ethereum", "solana", "usdc", "usdt", "pi"])
    .optional(),
  asset: z.enum(["OUSD", "BTC", "ETH", "SOL", "USDC", "USDT", "PI"]).optional(),
  /** OpenToken uuid — receive QR for a specific OpenPay token (not OUSD/majors). */
  token: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/wallet_/receive")({
  head: () => ({ meta: [{ title: "Receive — OpenPay Pro" }] }),
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  component: WalletReceivePage,
});

type NetworkId = "openpay" | "bitcoin" | "ethereum" | "solana" | "usdc" | "usdt" | "pi";
type AssetCode = "OUSD" | "BTC" | "ETH" | "SOL" | "USDC" | "USDT" | "PI";
type ReceiveToken = {
  id: string;
  name: string;
  symbol: string;
  logo_url: string | null;
};

const NETWORKS: Array<{
  id: NetworkId;
  label: string;
  asset: AssetCode;
  accent: string;
  logoUrl: string | null;
  isOusd?: boolean;
}> = [
  {
    id: "openpay",
    label: "OpenPay",
    asset: "OUSD",
    accent: "#8B5CF6",
    logoUrl: OUSD_LOGO_URL,
    isOusd: true,
  },
  {
    id: "bitcoin",
    label: "Bitcoin",
    asset: "BTC",
    accent: "#F7931A",
    logoUrl: MAJOR_TOKENS.btc.logoUrl,
  },
  {
    id: "ethereum",
    label: "Ethereum",
    asset: "ETH",
    accent: "#627EEA",
    logoUrl: MAJOR_TOKENS.eth.logoUrl,
  },
  {
    id: "solana",
    label: "Solana",
    asset: "SOL",
    accent: "#9945FF",
    logoUrl: MAJOR_TOKENS.sol.logoUrl,
  },
  {
    id: "usdc",
    label: "USDC",
    asset: "USDC",
    accent: "#2775CA",
    logoUrl: MAJOR_TOKENS.usdc.logoUrl,
  },
  {
    id: "usdt",
    label: "USDT",
    asset: "USDT",
    accent: "#26A17B",
    logoUrl: MAJOR_TOKENS.usdt.logoUrl,
  },
  {
    id: "pi",
    label: "Pi Network",
    asset: "PI",
    accent: "#6B4EFF",
    logoUrl: PI_NETWORK_LOGO_URL,
  },
];

function networkFromAsset(asset: AssetCode): NetworkId {
  if (asset === "BTC") return "bitcoin";
  if (asset === "ETH") return "ethereum";
  if (asset === "SOL") return "solana";
  if (asset === "USDC") return "usdc";
  if (asset === "USDT") return "usdt";
  if (asset === "PI") return "pi";
  return "openpay";
}

function WalletReceivePage() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();

  const tokenId = search.token;
  const initialNetwork =
    tokenId
      ? "openpay"
      : (search.network ?? (search.asset ? networkFromAsset(search.asset) : "openpay"));
  const [network, setNetwork] = useState<NetworkId>(initialNetwork);
  const [qrUrl, setQrUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [piLinkBusy, setPiLinkBusy] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(RECEIVE_NOTE_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setNoteOpen(true);
  }, []);

  function dismissNote() {
    setNoteOpen(false);
    try {
      sessionStorage.setItem(RECEIVE_NOTE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  const selected = NETWORKS.find((n) => n.id === network) ?? NETWORKS[0]!;

  const { data: wallet, isLoading } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () =>
      (
        await supabase
          .from("wallets")
          .select("id, name, address")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  const { data: openToken, isLoading: tokenLoading } = useQuery({
    queryKey: ["receive-token", tokenId],
    enabled: !!tokenId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("id, name, symbol, logo_url")
        .eq("id", tokenId!)
        .maybeSingle();
      if (error) throw error;
      return data as ReceiveToken | null;
    },
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile-pi-link", user.id],
    enabled: network === "pi" || search.asset === "PI",
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("pi_uid, pi_username, pi_wallet_address")
          .eq("id", user.id)
          .maybeSingle()
      ).data,
  });
  const piLinked = !!(profile?.pi_wallet_address || profile?.pi_username);

  const displayAsset = openToken?.symbol ?? selected.asset;
  const displayLabel = openToken
    ? openToken.name || openToken.symbol
    : selected.label;
  const displayLogo = openToken?.logo_url ?? selected.logoUrl;
  const displayIsOusd = !openToken && !!selected.isOusd;

  const payUri = useMemo(() => {
    if (!wallet?.address) return "";
    if (openToken?.id) {
      const params = new URLSearchParams({
        asset: openToken.symbol,
        token: openToken.id,
      });
      return `openpay:${wallet.address}?${params.toString()}`;
    }
    return `openpay:${wallet.address}?asset=${selected.asset}`;
  }, [wallet?.address, selected.asset, openToken]);

  useEffect(() => {
    let cancelled = false;
    if (!payUri) {
      setQrUrl("");
      return;
    }
    void QRCode.toDataURL(payUri, {
      width: 220,
      margin: 1,
      color: { dark: "#111111", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [payUri]);

  function selectNetwork(id: NetworkId) {
    const net = NETWORKS.find((n) => n.id === id)!;
    setNetwork(id);
    void navigate({
      search: { network: id, asset: net.asset },
      replace: true,
    });
  }

  async function copyAddress() {
    if (!wallet?.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      toast.success(`${displayAsset} receive address copied`);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function copyPayUri() {
    if (!payUri) return;
    try {
      await navigator.clipboard.writeText(payUri);
      toast.success("Receive link copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  async function share() {
    if (!payUri) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Receive ${displayAsset}`,
          text: `Send ${displayAsset} to my OpenPay Pro wallet`,
          url: payUri,
        });
      } else {
        await copyPayUri();
      }
    } catch {
      /* user cancelled */
    }
  }

  async function connectPiWallet() {
    setPiLinkBusy(true);
    try {
      const linked = await linkPiWallet();
      toast.success(
        `Pi linked @${linked.pi_username} · ${shortAddress(linked.pi_wallet_address, 6, 6)}`,
      );
      await qc.invalidateQueries({ queryKey: ["profile-pi-link", user.id] });
    } catch (e) {
      toast.error((e as Error).message || "Pi Auth failed");
    } finally {
      setPiLinkBusy(false);
    }
  }

  const pageLoading = isLoading || (!!tokenId && tokenLoading);

  return (
    <div className="ot-phantom mx-auto w-full max-w-lg animate-page-in pb-10">
      <Dialog open={noteOpen} onOpenChange={(open) => (open ? setNoteOpen(true) : dismissNote())}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <div className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle>OpenPay wallet transfers only</DialogTitle>
            <DialogDescription className="space-y-3 text-left text-sm leading-relaxed text-muted-foreground">
              <span className="block">
                Right now you can only receive from <strong className="text-foreground">OpenPay Pro</strong>{" "}
                and other <strong className="text-foreground">OpenPay wallets</strong> (wallet → wallet
                inside OpenPay).
              </span>
              <span className="block">
                <strong className="text-foreground">External wallets are not supported yet</strong>{" "}
                (MetaMask, Phantom, exchanges, etc.). Sending crypto from an external wallet to this
                address will <strong className="text-destructive">not credit your balance</strong> and
                those funds may be lost.
              </span>
              <span className="block">External wallet deposits are coming soon.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-stretch">
            <Button type="button" className="w-full rounded-full" onClick={dismissNote}>
              I understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <header className="mb-5 flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link to="/wallet">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold tracking-tight">Receive</h1>
          <p className="ph-caption">
            {openToken ? `${openToken.symbol} · OpenPay token` : "Pick a network · OpenPay Pro wallet"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full text-amber-500"
          aria-label="Receive important notice"
          onClick={() => setNoteOpen(true)}
        >
          <AlertTriangle className="h-5 w-5" />
        </Button>
      </header>

      {/* Network chips — Phantom style (majors only; OpenToken QR is token-specific) */}
      {!openToken ? (
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {NETWORKS.map((n) => {
          const active = network === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => selectNetwork(n.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold press",
                active
                  ? "text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
              style={active ? { backgroundColor: n.accent } : undefined}
            >
              {n.isOusd ? (
                <OusdIcon className="h-5 w-5 rounded-full" />
              ) : n.logoUrl ? (
                <img src={n.logoUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
              ) : null}
              {n.label}
            </button>
          );
        })}
      </div>
      ) : (
        <div className="mb-5">
          <Link
            to="/wallet/receive"
            search={{ network: "openpay", asset: "OUSD" }}
            className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
          >
            ← Receive network assets
          </Link>
        </div>
      )}

      {pageLoading ? (
        <div className="rounded-3xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading wallet…
        </div>
      ) : tokenId && !openToken ? (
        <div className="rounded-3xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Token not found.</p>
          <Button asChild className="mt-4 rounded-full">
            <Link to="/wallet">Back to Wallet</Link>
          </Button>
        </div>
      ) : !wallet?.address ? (
        <div className="rounded-3xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No OpenPay Pro wallet found.</p>
          <Button asChild className="mt-4 rounded-full">
            <Link to="/dashboard">Go to Home</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-6 text-center">
            <div className="mb-1 flex items-center justify-center gap-2">
              {displayIsOusd ? (
                <OusdIcon className="h-8 w-8 rounded-full" />
              ) : displayLogo ? (
                <img
                  src={displayLogo}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-[10px] font-bold">
                  {displayAsset.slice(0, 2)}
                </span>
              )}
              <p className="text-lg font-extrabold tracking-tight">{displayAsset}</p>
            </div>
            <p className="ph-caption">
              {displayLabel} · credits your OpenPay Pro balance
            </p>

            {network === "pi" && (
              <div className="mt-4 rounded-2xl border border-[#6B4EFF]/30 bg-[#6B4EFF]/10 px-3 py-3 text-left">
                {profileLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Checking Pi link…
                  </div>
                ) : piLinked ? (
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-semibold text-foreground">
                        Pi linked
                        {profile?.pi_username ? ` · @${profile.pi_username}` : ""}
                      </p>
                      {profile?.pi_wallet_address ? (
                        <button
                          type="button"
                          className="mt-1 break-all font-mono text-[11px] text-[#6B4EFF]"
                          onClick={() => {
                            void navigator.clipboard.writeText(profile.pi_wallet_address!);
                            toast.success("Pi wallet address copied");
                          }}
                        >
                          {profile.pi_wallet_address}
                        </button>
                      ) : null}
                      <p className="mt-1 text-muted-foreground">
                        Linked via Pi Auth — no manual address. Pro PI QR below is OpenPay → OpenPay.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="shrink-0 rounded-full"
                      disabled={piLinkBusy}
                      onClick={() => void connectPiWallet()}
                    >
                      {piLinkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground">Link Pi wallet with Pi Auth</p>
                    <p className="text-[11px] text-muted-foreground">
                      Open in Pi Browser — we fetch your wallet address automatically.
                    </p>
                    <Button
                      type="button"
                      className="w-full rounded-full bg-[#6B4EFF] text-white hover:opacity-90"
                      disabled={piLinkBusy}
                      onClick={() => void connectPiWallet()}
                    >
                      {piLinkBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Link2 className="mr-2 h-4 w-4" />
                      )}
                      Link with Pi Auth
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="mx-auto mt-5 grid h-52 w-52 place-items-center rounded-2xl border border-border bg-white p-3">
              {qrUrl ? (
                <img src={qrUrl} alt={`Receive ${displayAsset} QR`} className="h-full w-full" />
              ) : (
                <QrCode className="h-16 w-16 text-muted-foreground" />
              )}
            </div>

            <p className="mt-5 break-all font-mono text-sm font-semibold tracking-tight text-foreground">
              {wallet.address}
            </p>
            <p className="ph-caption mt-1">
              ({shortAddress(wallet.address, 8, 8)}) · {wallet.name || "Main Wallet"}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" className="rounded-full" onClick={() => void copyAddress()}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied" : "Copy address"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="rounded-full"
                onClick={() => void share()}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </div>

            <button
              type="button"
              className="mt-3 text-xs font-semibold text-primary underline-offset-2 hover:underline"
              onClick={() => void copyPayUri()}
            >
              Copy openpay: receive link
            </button>
          </div>

          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[12px] leading-relaxed text-amber-950 dark:border-amber-500/30 dark:text-amber-100/90">
            <p className="font-semibold text-amber-900 dark:text-amber-200">OpenPay → OpenPay only</p>
            <p className="mt-1 text-amber-800/90 dark:text-amber-100/80">
              Receive from OpenPay Pro / OpenPay wallets only. Do not send from MetaMask, Phantom,
              exchanges, or other external wallets — those deposits will not credit your balance and
              funds may be lost. External support is coming soon.
            </p>
            <button
              type="button"
              className="mt-2 text-xs font-bold text-amber-900 underline-offset-2 hover:underline dark:text-amber-200"
              onClick={() => setNoteOpen(true)}
            >
              Read full notice
            </button>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-center text-[11px] leading-relaxed text-muted-foreground">
            Send <strong className="text-foreground">{displayAsset}</strong> to this OpenPay Pro
            address. Your{" "}
            <strong className="text-foreground">{displayLabel}</strong> balance updates when another
            OpenPay user sends you {displayAsset}
            {openToken ? " on OpenPay." : ". Use the matching network tab for each token."}
          </div>

          {/* All networks list — hide when viewing a specific OpenToken QR */}
          {!openToken ? (
          <section>
            <h2 className="ph-label mb-2 px-1">All receive addresses</h2>
            <ul className="overflow-hidden rounded-2xl border border-border bg-card">
              {NETWORKS.map((n, i) => (
                <li key={n.id} className={cn(i > 0 && "border-t border-border")}>
                  <button
                    type="button"
                    onClick={() => selectNetwork(n.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left press hover:bg-muted/30",
                      network === n.id && "bg-primary/5",
                    )}
                  >
                    {n.isOusd ? (
                      <OusdIcon className="h-9 w-9 shrink-0 rounded-full" />
                    ) : n.logoUrl ? (
                      <img
                        src={n.logoUrl}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-muted text-[10px] font-bold">
                        {n.asset}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{n.label}</span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {shortAddress(wallet.address, 6, 6)} · {n.asset}
                      </span>
                    </span>
                    {network === n.id ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <QrCode className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
