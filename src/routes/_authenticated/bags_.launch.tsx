import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/wallet/PageHeader";
import { BagsWalletBar } from "@/components/bags/BagsWalletBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  bagsCreateFeeShareConfig,
  bagsCreateLaunchTx,
  bagsCreateTokenInfo,
  bagsSendSignedTx,
} from "@/lib/bags.functions";
import { bagsTokenUrl, LAMPORTS_PER_SOL, solscanTxUrl } from "@/lib/bags-client";
import { ensureBuffer } from "@/lib/buffer-polyfill";

export const Route = createFileRoute("/_authenticated/bags_/launch")({
  head: () => ({ meta: [{ title: "Launch — Bags" }] }),
  component: BagsLaunchPage,
});

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
        throw new Error("Name, symbol, description, and image URL are required");
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

  return (
    <div className="mx-auto w-full max-w-lg pb-10">
      <PageHeader title="Launch token" backTo="/bags" />
      <BagsWalletBar className="mb-4" onAddress={setWallet} />

      <p className="mb-4 rounded-2xl bg-violet-500/10 px-3 py-2.5 text-xs text-muted-foreground">
        Launches attach OpenPay’s Bags partner key so platform fees route via{" "}
        <a
          href="https://bags.fm/?ref=mrwain"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          bags.fm/?ref=mrwain
        </a>
        .
      </p>

      <div className="space-y-3">
        <div>
          <Label htmlFor="bags-name">Name</Label>
          <Input
            id="bags-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 h-11 rounded-2xl"
            maxLength={32}
            placeholder="My Token"
          />
        </div>
        <div>
          <Label htmlFor="bags-symbol">Symbol</Label>
          <Input
            id="bags-symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="mt-1.5 h-11 rounded-2xl"
            maxLength={10}
            placeholder="BAGS"
          />
        </div>
        <div>
          <Label htmlFor="bags-desc">Description</Label>
          <Textarea
            id="bags-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1.5 min-h-24 rounded-2xl"
            maxLength={500}
          />
        </div>
        <div>
          <Label htmlFor="bags-image">Image URL</Label>
          <Input
            id="bags-image"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="mt-1.5 h-11 rounded-2xl"
            placeholder="https://…"
          />
        </div>
        <div>
          <Label htmlFor="bags-buy">Initial buy (SOL)</Label>
          <Input
            id="bags-buy"
            value={initialBuySol}
            onChange={(e) => setInitialBuySol(e.target.value)}
            className="mt-1.5 h-11 rounded-2xl"
            inputMode="decimal"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="bags-web">Website</Label>
            <Input
              id="bags-web"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="mt-1.5 h-11 rounded-2xl"
            />
          </div>
          <div>
            <Label htmlFor="bags-tw">Twitter</Label>
            <Input
              id="bags-tw"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              className="mt-1.5 h-11 rounded-2xl"
            />
          </div>
          <div>
            <Label htmlFor="bags-tg">Telegram</Label>
            <Input
              id="bags-tg"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              className="mt-1.5 h-11 rounded-2xl"
            />
          </div>
        </div>

        <Button
          type="button"
          className="mt-2 h-12 w-full rounded-full text-base font-bold"
          disabled={busy}
          onClick={() => void launch()}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Launch with Phantom"}
        </Button>

        {resultMint ? (
          <div className="rounded-2xl bg-emerald-500/10 px-3 py-3 text-sm">
            <div className="font-semibold">Launched</div>
            <div className="mt-1 break-all font-mono text-xs">{resultMint}</div>
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
    </div>
  );
}
