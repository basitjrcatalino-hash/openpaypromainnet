"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildSolanaPayQrSvg } from "@/lib/solana-pay";
import {
  SOLANA_MERCHANT_NAME,
  isSolanaMerchantConfigured,
  resolveSolanaMerchantWallet,
} from "@/lib/solana-payment";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

/**
 * Standalone Solana Pay QR using @solana-commerce/solana-pay.
 * Docs: https://solana.com/docs/tools/commerce-kit/quickstart/solana-pay
 */
export function SolanaPayQrPanel({
  merchantWallet,
  className,
  defaultAmountSol = "",
}: {
  merchantWallet?: string | null;
  className?: string;
  defaultAmountSol?: string;
}) {
  const wallet = resolveSolanaMerchantWallet(merchantWallet);
  const [amountSol, setAmountSol] = useState(defaultAmountSol);
  const [svg, setSvg] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSolanaMerchantConfigured(wallet)) {
      setSvg(null);
      setUrl(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const sol = Number(amountSol);
    void buildSolanaPayQrSvg({
      recipient: wallet,
      amountSol: Number.isFinite(sol) && sol > 0 ? sol : undefined,
      label: SOLANA_MERCHANT_NAME,
      message: "OpenPay Pro · Solana Pay",
      size: 360,
    })
      .then((r) => {
        if (cancelled) return;
        setSvg(r.svg);
        setUrl(r.url);
      })
      .catch((err) => {
        if (cancelled) return;
        setSvg(null);
        setUrl(null);
        toast.error((err as Error).message || "Could not build Solana Pay QR");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wallet, amountSol]);

  if (!isSolanaMerchantConfigured(wallet)) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        Set <code className="font-mono text-[11px]">VITE_SOLANA_MERCHANT_WALLET</code> or connect
        Phantom to generate a Solana Pay QR.
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
          Amount (SOL, optional)
        </label>
        <Input
          inputMode="decimal"
          placeholder="Leave empty for open amount"
          value={amountSol}
          onChange={(e) => setAmountSol(e.target.value)}
          className="rounded-xl"
        />
      </div>

      <div className="mx-auto grid aspect-square w-full max-w-[280px] place-items-center rounded-2xl bg-white p-4 shadow-sm">
        {busy || !svg ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : svg.trimStart().startsWith("<") ? (
          <div
            className="h-full w-full [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <img src={svg} alt="Solana Pay QR" className="h-full w-full object-contain" />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 rounded-full"
          disabled={!url}
          onClick={async () => {
            if (!url) return;
            try {
              await copyText(url);
              toast.success("Solana Pay link copied");
            } catch {
              toast.error("Copy failed");
            }
          }}
        >
          <Copy className="mr-1.5 h-4 w-4" />
          Copy solana: link
        </Button>
        <a
          href={url ?? undefined}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold",
            !url && "pointer-events-none opacity-50",
          )}
        >
          <QrCode className="h-4 w-4" />
          Open link
        </a>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        Scan with Phantom or any Solana Pay wallet · recipient{" "}
        <span className="font-mono">{wallet.slice(0, 4)}…{wallet.slice(-4)}</span>
      </p>
    </div>
  );
}
