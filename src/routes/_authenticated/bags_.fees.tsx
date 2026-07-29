import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/wallet/PageHeader";
import { BagsWalletBar } from "@/components/bags/BagsWalletBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  bagsClaimPartnerFees,
  bagsCreatePartnerConfigTx,
  bagsGetClaimTxs,
  bagsPartnerStatus,
  bagsSendSignedTx,
} from "@/lib/bags.functions";
import {
  connectBagsWallet,
  signAndSendBagsTransactions,
  solscanTxUrl,
} from "@/lib/bags-sign";

export const Route = createFileRoute("/_authenticated/bags_/fees")({
  head: () => ({ meta: [{ title: "Fees — Bags" }] }),
  component: BagsFeesPage,
});

function BagsFeesPage() {
  const getClaims = useServerFn(bagsGetClaimTxs);
  const partnerStatus = useServerFn(bagsPartnerStatus);
  const claimPartner = useServerFn(bagsClaimPartnerFees);
  const createPartner = useServerFn(bagsCreatePartnerConfigTx);
  const sendSigned = useServerFn(bagsSendSignedTx);

  const [wallet, setWallet] = useState<string | null>(null);
  const [mint, setMint] = useState("");
  const [busy, setBusy] = useState(false);
  const [partnerInfo, setPartnerInfo] = useState<string | null>(null);
  const [lastSigs, setLastSigs] = useState<string[]>([]);

  async function ensureWallet(): Promise<string> {
    if (wallet) return wallet;
    const addr = await connectBagsWallet();
    setWallet(addr);
    return addr;
  }

  async function claimTokenFees() {
    setBusy(true);
    setLastSigs([]);
    try {
      const address = await ensureWallet();
      if (!mint.trim()) throw new Error("Enter a token mint");
      const res = await getClaims({
        data: { wallet: address, tokenMint: mint.trim() },
      });
      if (!res.transactions.length) {
        toast.message("No claimable fees for this mint");
        return;
      }
      toast.message(`Sign ${res.transactions.length} claim transaction(s)…`);
      const sigs = await signAndSendBagsTransactions(
        res.transactions,
        async (signedTxBase64) => {
          const r = await sendSigned({ data: { signedTxBase64 } });
          return r.signature;
        },
      );
      setLastSigs(sigs);
      toast.success("Fee claim submitted");
    } catch (err) {
      toast.error((err as Error).message || "Claim failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadPartner() {
    setBusy(true);
    try {
      // Prefer server-configured partner wallet; Phantom only as override
      const res = await partnerStatus({
        data: {},
      });
      const lines = [
        res.partnerRefUrl ? `Referral: ${res.partnerRefUrl}` : null,
        res.partnerConfigPda ? `Partner key (PDA): ${res.partnerConfigPda}` : null,
        res.partnerWallet ? `Partner wallet: ${res.partnerWallet}` : null,
        res.partnerBps != null ? `Partner fee share: ${res.partnerBps / 100}%` : null,
        res.configuredUuid ? `Configured UUID: ${res.configuredUuid}` : null,
        res.me ? `Bags user: @${res.me.username} (${res.me.uuid})` : "Bags auth/me unavailable",
        res.claimStats
          ? `Partner claimed: ${res.claimStats.claimedFees} · unclaimed: ${res.claimStats.unclaimedFees}`
          : "No partner claim stats yet",
        res.hasPartnerConfig ? "Partner config found on-chain" : "Partner config not found for wallet",
      ].filter(Boolean);
      setPartnerInfo(lines.join("\n"));
    } catch (err) {
      toast.error((err as Error).message || "Partner status failed");
    } finally {
      setBusy(false);
    }
  }

  async function createPartnerConfig() {
    setBusy(true);
    setLastSigs([]);
    try {
      const address = await ensureWallet();
      const res = await createPartner({ data: { partnerWallet: address } });
      toast.message("Sign partner config in Phantom…");
      const sigs = await signAndSendBagsTransactions(
        [res.transaction],
        async (signedTxBase64) => {
          const r = await sendSigned({ data: { signedTxBase64 } });
          return r.signature;
        },
      );
      setLastSigs(sigs);
      toast.success("Partner config submitted");
      await loadPartner();
    } catch (err) {
      toast.error((err as Error).message || "Partner config failed");
    } finally {
      setBusy(false);
    }
  }

  async function claimPartnerFees() {
    setBusy(true);
    setLastSigs([]);
    try {
      const status = await partnerStatus({ data: {} });
      const address = status.partnerWallet || (await ensureWallet());
      if (!address) throw new Error("No partner wallet configured");
      const res = await claimPartner({ data: { partnerWallet: address } });
      if (!res.transactions.length) {
        toast.message("No partner fees to claim");
        return;
      }
      toast.message(`Sign ${res.transactions.length} partner claim(s)…`);
      const sigs = await signAndSendBagsTransactions(
        res.transactions,
        async (signedTxBase64) => {
          const r = await sendSigned({ data: { signedTxBase64 } });
          return r.signature;
        },
      );
      setLastSigs(sigs);
      toast.success("Partner fees claimed");
    } catch (err) {
      toast.error((err as Error).message || "Partner claim failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg pb-10">
      <PageHeader title="Fees" backTo="/bags" />
      <BagsWalletBar className="mb-4" onAddress={setWallet} />

      <section className="mb-6 space-y-3">
        <h2 className="text-sm font-bold">Claim token fees</h2>
        <div>
          <Label>Token mint</Label>
          <Input
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            className="mt-1.5 h-11 rounded-2xl font-mono text-xs"
            placeholder="Token mint address"
          />
        </div>
        <Button
          type="button"
          className="h-11 w-full rounded-full font-bold"
          disabled={busy}
          onClick={() => void claimTokenFees()}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Claim fees"}
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold">Partner</h2>
        <p className="text-xs text-muted-foreground">
          Platform partner key is configured server-side (
          <a
            href="https://bags.fm/?ref=mrwain"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            bags.fm/?ref=mrwain
          </a>
          ). Status / claim uses that wallet by default; connect Phantom only if you need to
          create a new partner config for a different wallet.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button
            type="button"
            variant="secondary"
            className="h-11 rounded-full"
            disabled={busy}
            onClick={() => void loadPartner()}
          >
            Status
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-11 rounded-full"
            disabled={busy}
            onClick={() => void createPartnerConfig()}
          >
            Create config
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full font-bold"
            disabled={busy}
            onClick={() => void claimPartnerFees()}
          >
            Claim partner
          </Button>
        </div>
        {partnerInfo ? (
          <pre className="whitespace-pre-wrap rounded-2xl bg-muted/50 px-3 py-2.5 text-xs">
            {partnerInfo}
          </pre>
        ) : null}
      </section>

      {lastSigs.length ? (
        <ul className="mt-4 space-y-1 text-sm">
          {lastSigs.map((sig) => (
            <li key={sig}>
              <a
                href={solscanTxUrl(sig)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-primary"
              >
                {sig.slice(0, 12)}… <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
