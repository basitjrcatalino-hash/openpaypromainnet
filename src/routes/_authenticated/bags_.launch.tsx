import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ExternalLink, ImageIcon, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/wallet/PageHeader";
import { BagsCashIcon } from "@/components/bags/BagsCashIcon";
import { BagsWalletBar } from "@/components/bags/BagsWalletBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  bagsCreateFeeShareConfig,
  bagsCreateLaunchTx,
  bagsCreateTokenInfo,
  bagsSendSignedTx,
} from "@/lib/bags.functions";
import { bagsTokenUrl, LAMPORTS_PER_SOL, solscanTxUrl } from "@/lib/bags-client";
import { ensureBuffer } from "@/lib/buffer-polyfill";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/bags_/launch")({
  head: () => ({ meta: [{ title: "Launch — Bags Cash" }] }),
  component: BagsLaunchPage,
});

const BUY_PRESETS = [
  { label: "0.01", sol: "0.01" },
  { label: "0.05", sol: "0.05" },
  { label: "0.1", sol: "0.1" },
  { label: "0.25", sol: "0.25" },
  { label: "0.5", sol: "0.5" },
] as const;

function BagsLaunchPage() {
  const createInfo = useServerFn(bagsCreateTokenInfo);
  const createConfig = useServerFn(bagsCreateFeeShareConfig);
  const createLaunch = useServerFn(bagsCreateLaunchTx);
  const sendSigned = useServerFn(bagsSendSignedTx);

  const [wallet, setWallet] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [socialsOpen, setSocialsOpen] = useState(false);
  const [feeSharing, setFeeSharing] = useState(true);
  const [initialBuySol, setInitialBuySol] = useState("0.1");
  const [busy, setBusy] = useState(false);
  const [resultMint, setResultMint] = useState<string | null>(null);
  const [resultSig, setResultSig] = useState<string | null>(null);

  async function launch() {
    setBusy(true);
    setResultMint(null);
    setResultSig(null);
    try {
      await ensureBuffer();
      const { connectBagsWallet, signAndSendBagsTransactions } = await import("@/lib/bags-sign");
      let address = wallet;
      if (!address) {
        address = await connectBagsWallet();
        setWallet(address);
      }
      if (!name.trim() || !symbol.trim() || !description.trim() || !imageUrl.trim()) {
        throw new Error("Name, ticker, description, and image URL are required");
      }
      const buySol = Number(initialBuySol);
      if (!Number.isFinite(buySol) || buySol < 0) {
        throw new Error("Initial buy must be a valid SOL amount");
      }
      const initialBuyLamports = Math.round(buySol * LAMPORTS_PER_SOL);
      if (initialBuyLamports < 1) {
        throw new Error("Initial buy must be at least a tiny fraction of SOL");
      }

      toast.message("Creating token metadata…");
      const info = await createInfo({
        data: {
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          description: description.trim(),
          imageUrl: imageUrl.trim(),
          website: website.trim() || undefined,
          twitter: twitter.trim() || undefined,
          telegram: telegram.trim() || undefined,
        },
      });

      toast.message("Creating fee-share config…");
      const config = await createConfig({
        data: {
          tokenMint: info.tokenMint,
          payer: address,
          claimerWallet: address,
          claimerBps: 10_000,
        },
      });

      if (config.transactions.length) {
        toast.message(`Sign ${config.transactions.length} config transaction(s) in Phantom…`);
        await signAndSendBagsTransactions(config.transactions, async (signedTxBase64) => {
          const r = await sendSigned({ data: { signedTxBase64 } });
          return r.signature;
        });
      }

      toast.message("Building launch transaction…");
      const launchTx = await createLaunch({
        data: {
          metadataUrl: info.tokenMetadata,
          tokenMint: info.tokenMint,
          launchWallet: address,
          initialBuyLamports,
          configKey: config.configKey,
        },
      });

      toast.message("Sign launch in Phantom…");
      const [sig] = await signAndSendBagsTransactions(
        [launchTx.transaction],
        async (signedTxBase64) => {
          const r = await sendSigned({ data: { signedTxBase64 } });
          return r.signature;
        },
      );

      setResultMint(info.tokenMint);
      setResultSig(sig ?? null);
      toast.success("Token launched on Bags!");
    } catch (err) {
      const msg = (err as Error).message || "Launch failed";
      toast.error(
        /reading 'from'|Buffer/i.test(msg)
          ? "Wallet runtime failed to load (Buffer). Refresh and try again."
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  const fieldClass =
    "mt-1.5 h-11 rounded-xl border-white/10 bg-[#0c0f0d] text-white placeholder:text-white/30 focus-visible:ring-emerald-500/40";

  return (
    <div className="mx-auto w-full max-w-lg pb-10">
      <PageHeader title="Launch" backTo="/bags" />
      <BagsWalletBar className="mb-4 border border-white/5 bg-[#121512]" onAddress={setWallet} />

      <p className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-100/90">
        Launches attach OpenPay’s Bags partner key so platform fees route via{" "}
        <a
          href="https://bags.fm/?ref=mrwain"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-emerald-300 underline-offset-2 hover:underline"
        >
          bags.fm/?ref=mrwain
        </a>
        .
      </p>

      {/* COIN DETAILS */}
      <section className="mb-3 rounded-2xl border border-white/5 bg-[#121512] p-4">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
          Coin details
        </h2>

        <div className="mb-3">
          <label className="mb-1.5 block text-xs text-white/50">Image URL</label>
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-[#0c0f0d] px-3 py-5",
              imageUrl.trim() && "border-emerald-500/30",
            )}
          >
            {imageUrl.trim() ? (
              <img
                src={imageUrl.trim()}
                alt=""
                className="h-20 w-20 rounded-xl object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <ImageIcon className="h-8 w-8 text-white/25" />
            )}
            <span className="text-[11px] font-bold uppercase tracking-wide text-white/40">
              Upload image
            </span>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className={cn(fieldClass, "w-full")}
              placeholder="https://…"
            />
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="bags-name" className="text-xs text-white/50">
              Name
            </label>
            <Input
              id="bags-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
              maxLength={32}
              placeholder="Name"
            />
          </div>
          <div>
            <label htmlFor="bags-symbol" className="text-xs text-white/50">
              Ticker
            </label>
            <Input
              id="bags-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className={fieldClass}
              maxLength={10}
              placeholder="TICKER"
            />
          </div>
        </div>

        <div className="mb-2">
          <label htmlFor="bags-desc" className="text-xs text-white/50">
            Description
          </label>
          <Textarea
            id="bags-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1.5 min-h-24 rounded-xl border-white/10 bg-[#0c0f0d] text-white placeholder:text-white/30 focus-visible:ring-emerald-500/40"
            maxLength={500}
            placeholder="Description"
          />
        </div>

        <button
          type="button"
          className="mt-2 flex w-full items-center justify-between py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45"
          onClick={() => setSocialsOpen((v) => !v)}
        >
          Social links (optional)
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", socialsOpen && "rotate-180")}
          />
        </button>
        {socialsOpen ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className={fieldClass}
              placeholder="Website"
            />
            <Input
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              className={fieldClass}
              placeholder="Twitter"
            />
            <Input
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              className={fieldClass}
              placeholder="Telegram"
            />
          </div>
        ) : null}
      </section>

      {/* FEE SHARING */}
      <section className="mb-3 rounded-2xl border border-white/5 bg-[#121512] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
              Fee sharing
            </h2>
            <p className="mt-1 text-xs text-white/45">
              Creator fees go to your Phantom wallet (100%). Partner fees route via OpenPay’s Bags
              key.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={feeSharing}
            onClick={() => setFeeSharing((v) => !v)}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors",
              feeSharing ? "bg-emerald-500" : "bg-white/15",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                feeSharing ? "left-5" : "left-0.5",
              )}
            />
          </button>
        </div>
        {!feeSharing ? (
          <p className="mt-2 text-xs text-amber-300/90">
            Fee sharing is required for Bags launches — it will still be applied on-chain.
          </p>
        ) : null}
      </section>

      {/* OWNERSHIP */}
      <section className="mb-4 rounded-2xl border border-white/5 bg-[#121512] p-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
          Ownership
        </h2>
        <p className="mt-1 text-xs text-white/45">Buy shares before anyone else.</p>

        <div className="relative mt-3">
          <BagsCashIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" />
          <Input
            value={initialBuySol}
            onChange={(e) => setInitialBuySol(e.target.value)}
            className={cn(fieldClass, "pl-11 pr-14 font-semibold tabular-nums")}
            inputMode="decimal"
            placeholder="0.00"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">
            SOL
          </span>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {BUY_PRESETS.map((p) => (
            <button
              key={p.sol}
              type="button"
              onClick={() => setInitialBuySol(p.sol)}
              className={cn(
                "rounded-lg border px-1 py-2 text-center text-[11px] font-bold tabular-nums transition-colors",
                initialBuySol === p.sol
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                  : "border-white/10 bg-[#0c0f0d] text-white/55 hover:border-white/20",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <Button
        type="button"
        className="h-12 w-full rounded-full bg-white text-base font-bold text-black hover:bg-white/90"
        disabled={busy}
        onClick={() => void launch()}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Launch with Phantom"}
      </Button>

      <button
        type="button"
        className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs text-white/40 hover:text-white/70"
        onClick={() => {
          const params = new URLSearchParams();
          if (name) params.set("name", name);
          if (symbol) params.set("ticker", symbol);
          if (description) params.set("description", description);
          if (imageUrl) params.set("image", imageUrl);
          void navigator.clipboard.writeText(
            `${window.location.origin}/bags/launch?${params.toString()}`,
          );
          toast.success("Launch settings link copied");
        }}
      >
        <Link2 className="h-3.5 w-3.5" />
        copy launch settings link
      </button>

      {resultMint ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 text-sm">
          <div className="font-semibold text-emerald-200">Launched</div>
          <div className="mt-1 break-all font-mono text-xs text-white/70">{resultMint}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary" className="rounded-full">
              <a href={bagsTokenUrl(resultMint)} target="_blank" rel="noreferrer">
                View on Bags <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </a>
            </Button>
            <Button asChild size="sm" variant="ghost" className="rounded-full">
              <Link to="/bags/token/$mint" params={{ mint: resultMint }}>
                Analytics
              </Link>
            </Button>
            {resultSig ? (
              <Button asChild size="sm" variant="ghost" className="rounded-full">
                <a href={solscanTxUrl(resultSig)} target="_blank" rel="noreferrer">
                  Solscan
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
