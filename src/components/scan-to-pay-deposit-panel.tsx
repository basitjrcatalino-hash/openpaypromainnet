"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { ArrowLeft, CheckCircle2, Copy, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDepositConfig } from "@/lib/deposit-gateway.functions";
import { submitScanPayTopup } from "@/lib/scan-pay.functions";
import { copyText } from "@/lib/clipboard";
import { OUSD_LOGO_URL } from "@/lib/token-logos";
import { cn } from "@/lib/utils";
import { formatUSD, shortAddress } from "@/lib/wallet-utils";

type Row = Record<string, unknown> & {
  id: string;
  name?: string;
  symbol?: string;
  key?: string;
  chain_id?: string;
  token_id?: string | null;
  address?: string;
  memo_tag?: string | null;
  maintenance_mode?: boolean;
  family?: string;
};

const SESSION_SECONDS = 120;
const STABLE_SYMBOLS = new Set(["USDC", "USDT", "CASH", "PYUSD", "USDG", "USD1", "SOL"]);

type Props = {
  amountUsd: number;
  walletId?: string;
  className?: string;
  onSuccess?: () => void;
  onBack?: () => void;
  onClose?: () => void;
};

/**
 * Phantom-style “Scan to pay” panel.
 * Admin receive wallets: Admin → Deposits.
 * Flow: pick chain/token → QR → send → paste TX ID → on-chain verify → OUSD on OpenLedger.
 */
export function ScanToPayDepositPanel({
  amountUsd,
  walletId,
  className,
  onSuccess,
  onBack,
  onClose,
}: Props) {
  const qc = useQueryClient();
  const configFn = useServerFn(getDepositConfig);
  const submitFn = useServerFn(submitScanPayTopup);

  const { data: config, isLoading } = useQuery({
    queryKey: ["deposit-config"],
    queryFn: () => configFn(),
  });

  const chains = useMemo(() => {
    const all = (config?.chains ?? []) as unknown as Row[];
    // Prefer Solana first for stables / CASH / SOL
    return [...all].sort((a, b) => {
      if (a.key === "solana") return -1;
      if (b.key === "solana") return 1;
      return 0;
    });
  }, [config?.chains]);

  const tokens = (config?.tokens ?? []) as unknown as Row[];
  const addresses = (config?.addresses ?? []) as unknown as Row[];

  const [chainId, setChainId] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [txHash, setTxHash] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [left, setLeft] = useState(SESSION_SECONDS);
  const [done, setDone] = useState<{ amount: number } | null>(null);

  useEffect(() => {
    if (!chainId && chains.length) setChainId(String(chains[0].id));
  }, [chains, chainId]);

  const chainTokens = useMemo(() => {
    const list = tokens.filter((t) => t.chain_id === chainId);
    const stables = list.filter((t) => STABLE_SYMBOLS.has(String(t.symbol ?? "").toUpperCase()));
    return stables.length ? stables : list;
  }, [tokens, chainId]);

  useEffect(() => {
    if (chainTokens.length && !chainTokens.some((t) => t.id === tokenId)) {
      // Prefer USDC, then CASH, then first
      const prefer =
        chainTokens.find((t) => t.symbol === "USDC") ||
        chainTokens.find((t) => t.symbol === "CASH") ||
        chainTokens[0];
      setTokenId(prefer.id);
    }
    if (!chainTokens.length) setTokenId("");
  }, [chainTokens, tokenId]);

  const chain = chains.find((c) => c.id === chainId) ?? null;
  const token = chainTokens.find((t) => t.id === tokenId) ?? null;

  const address = useMemo(() => {
    const forToken = addresses.find((a) => a.chain_id === chainId && a.token_id === tokenId);
    return forToken ?? addresses.find((a) => a.chain_id === chainId && !a.token_id) ?? null;
  }, [addresses, chainId, tokenId]);

  useEffect(() => {
    let alive = true;
    if (!address?.address) {
      setQr(null);
      return;
    }
    void QRCode.toDataURL(String(address.address), {
      width: 400,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [address?.address]);

  // Session countdown (refresh QR session feel)
  useEffect(() => {
    setLeft(SESSION_SECONDS);
    const id = window.setInterval(() => {
      setLeft((s) => (s <= 1 ? SESSION_SECONDS : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [chainId, tokenId, amountUsd]);

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");

  const submit = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          chain_id: chainId,
          token_id: tokenId,
          tx_hash: txHash.trim(),
          expected_amount: amountUsd > 0 ? amountUsd : undefined,
          walletId,
        },
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["active-wallet"] });
      void qc.invalidateQueries({ queryKey: ["wallets"] });
      void qc.invalidateQueries({ queryKey: ["txs"] });
      void qc.invalidateQueries({ queryKey: ["ledger-entries"] });
      void qc.invalidateQueries({ queryKey: ["my-deposits"] });
      if (r.alreadyCredited) {
        toast.message("This transaction was already credited");
      } else {
        toast.success(`${r.amount.toFixed(2)} OUSD credited to OpenLedger`);
      }
      setDone({ amount: r.amount });
      onSuccess?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className={cn("grid place-items-center py-16", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (done) {
    return (
      <div className={cn("space-y-4 rounded-3xl bg-card px-4 py-8 text-center", className)}>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <p className="text-lg font-semibold">Payment confirmed</p>
        <p className="text-sm text-muted-foreground">
          {done.amount.toFixed(2)} OUSD released to your wallet on OpenLedger.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-border/60 bg-background shadow-xl",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-base font-semibold">Scan to pay</h2>
        <button
          type="button"
          onClick={onClose ?? onBack}
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4 px-4 pb-5 pt-4">
        {/* Chain / token chips */}
        <div className="flex flex-wrap gap-1.5">
          {chains.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChainId(c.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                c.id === chainId
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chainTokens.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTokenId(t.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                t.id === tokenId
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {t.symbol}
            </button>
          ))}
        </div>

        {chain?.maintenance_mode ? (
          <p className="rounded-2xl bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-600">
            {chain.name} is paused for maintenance.
          </p>
        ) : !address?.address ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No receive wallet for this network yet. An admin must set one in{" "}
            <Link to="/admin/deposits" className="font-semibold text-primary">
              Admin → Deposits
            </Link>
            .
          </div>
        ) : (
          <>
            <div className="mx-auto grid aspect-square w-full max-w-70 place-items-center rounded-2xl bg-white p-4">
              {qr ? (
                <img src={qr} alt="Payment QR" className="h-full w-full object-contain" />
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              )}
            </div>

            <p className="text-center text-2xl font-bold tabular-nums tracking-tight text-foreground">
              {mm}:{ss}
            </p>

            <p className="text-center text-base font-semibold text-foreground">
              Send {formatUSD(amountUsd)} {token?.symbol ?? "USDC"}
            </p>
            <p className="text-center text-[11px] text-muted-foreground">
              Exact amount on {chain?.name}. Verified TX releases OUSD to your OpenLedger wallet.
            </p>

            <button
              type="button"
              onClick={async () => {
                try {
                  await copyText(String(address.address));
                  toast.success("Receive address copied");
                } catch {
                  toast.error("Copy failed");
                }
              }}
              className="mx-auto flex w-full max-w-xs items-center gap-2 rounded-full border border-border bg-card px-3 py-2.5 press"
            >
              <img src={OUSD_LOGO_URL} alt="" className="h-8 w-8 rounded-full object-cover" />
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-semibold">OpenPay Pro</span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">
                  {shortAddress(String(address.address), 6)}
                </span>
              </span>
              <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>

            {address.memo_tag ? (
              <p className="text-center text-xs text-amber-600">
                Include memo: <span className="font-mono">{String(address.memo_tag)}</span>
              </p>
            ) : null}

            <div className="space-y-2 pt-1">
              <label className="block text-xs font-semibold text-muted-foreground">
                Transaction ID
              </label>
              <Input
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder={
                  chain?.family === "solana"
                    ? "Paste Solana signature"
                    : "Paste 0x… transaction hash"
                }
                className="rounded-xl font-mono text-xs"
              />
              <Button
                type="button"
                className="w-full rounded-full"
                disabled={submit.isPending || txHash.trim().length < 16}
                onClick={() => submit.mutate()}
              >
                {submit.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Verify & release OUSD
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
