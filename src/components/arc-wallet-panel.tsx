import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Copy, Link2, Loader2, RefreshCw, Wallet } from "lucide-react";
import type { EIP1193Provider } from "viem";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { arcBalance, arcPayment, bridgeToArc, connectArcWallet, verifyArcWallet, submitOpenPayArcTransfer } from "@/lib/arc-wallet";
import { ArcConnectDialog } from "@/components/arc-connect-dialog";
import { getOpenPayArcSnapshot, prepareOpenPayArcPayment } from "@/lib/openpay-arc.functions";
import { fetchAuthMethodFlags } from "@/lib/auth-methods";

export default function ArcWalletPanel() {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [walletProvider, setWalletProvider] = useState<EIP1193Provider | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const afterConnect = useRef<((p: EIP1193Provider) => Promise<void>) | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [linked, setLinked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"send" | "bridge">("send");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [provider, setProvider] = useState<"circle" | "openpay">("circle");
  const snapshotFn = useServerFn(getOpenPayArcSnapshot);
  const prepareFn = useServerFn(prepareOpenPayArcPayment);
  const [source, setSource] = useState<"Base" | "Ethereum" | "Arbitrum">("Base");
  const [receipt, setReceipt] = useState<{ state: string; amount: string; network: string; transactions: { hash: string; url?: string }[] } | null>(null);
  const flags = useQuery({ queryKey: ["auth-methods"], queryFn: () => fetchAuthMethodFlags(supabase), refetchInterval: 15_000 });
  const balance = useQuery({ queryKey: ["arc-balance", address], queryFn: () => address ? arcBalance(address) : Promise.resolve("0"), enabled: !!address, refetchInterval: 30_000 });
  const partner = useQuery({ queryKey: ["openpay-arc", address, signedIn], queryFn: () => { if (!address) throw new Error("Connect a wallet first."); return snapshotFn({ data: { address } }); }, enabled: !!address && signedIn && flags.data?.arc.enabled === true, refetchInterval: 30_000, retry: false });
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user)); }, []);
  useEffect(() => {
    setLinked(false);
    if (!address || !signedIn) return;
    void supabase.from("arc_wallet_links").select("address").eq("address", address.toLowerCase()).maybeSingle().then(({ data }) => setLinked(!!data));
  }, [address, signedIn]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await action(); } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }
  function requestConnect(next?: (p: EIP1193Provider) => Promise<void>) {
    afterConnect.current = next ?? null;
    setConnectOpen(true);
  }
  async function handleSelect(selected: EIP1193Provider) {
    setConnectOpen(false);
    await run(async () => {
      setWalletProvider(selected);
      setAddress(await connectArcWallet(selected));
      setReceipt(null);
      if (afterConnect.current) await afterConnect.current(selected);
    });
  }
  const accessEnabled = flags.data?.arc.enabled === true && !flags.isError;
  return <div className="space-y-8">
    <ArcConnectDialog open={connectOpen} onOpenChange={setConnectOpen} busy={busy} onSelect={p => void handleSelect(p)} />
    <section className="border-y border-border py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-sm text-muted-foreground">Arc Mainnet · USDC</p><p className="mt-2 text-4xl font-semibold tabular-nums">{!address ? "—" : balance.isError ? "Unavailable" : balance.isPending ? "…" : Number(balance.data).toLocaleString(undefined, { maximumFractionDigits: 6 })}</p></div>
        <Button variant="outline" size="icon" aria-label="Refresh Arc balance" disabled={!address || balance.isFetching} onClick={() => void balance.refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {address && <div className="mt-4 flex items-center gap-2"><p className="min-w-0 break-all font-mono text-sm">{address}</p><Button size="icon" variant="ghost" aria-label="Copy wallet address" onClick={() => void navigator.clipboard.writeText(address).then(() => toast.success("Address copied"))}><Copy className="h-4 w-4" /></Button></div>}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button disabled={busy || !accessEnabled} onClick={() => requestConnect()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}{address ? "Change wallet" : "Connect wallet"}</Button>
        {signedIn && address && <Button variant="outline" disabled={busy || linked || !accessEnabled} onClick={() => void run(async () => { const verified = await verifyArcWallet("link", walletProvider ?? undefined); setAddress(verified); setLinked(true); toast.success("Wallet linked to your existing account"); })}><Link2 className="h-4 w-4" />{linked ? "Wallet linked" : "Link to my account"}</Button>}
        {!signedIn && <Button variant="outline" disabled={busy || !accessEnabled} onClick={() => requestConnect(async p => { await verifyArcWallet("login", p); window.location.assign("/dashboard"); })}>Sign in with linked wallet</Button>}
      </div>
      {!signedIn && <p className="mt-4 text-sm text-muted-foreground">Existing account? <Link to="/authpi" search={{ next: "/arc" }} className="text-primary underline">Sign in to link your wallet</Link></p>}
      {(flags.isError || (!flags.isPending && !accessEnabled)) && <p role="status" className="mt-4 text-sm text-destructive">Arc wallet access is currently unavailable.</p>}
    </section>
    {address && <section className="space-y-5">
      <div className="flex gap-2" role="group" aria-label="Arc transaction type"><Button variant={mode === "send" ? "default" : "outline"} aria-pressed={mode === "send"} disabled={busy} onClick={() => setMode("send")}><ArrowUpRight className="h-4 w-4" />Send USDC</Button><Button variant={mode === "bridge" ? "default" : "outline"} aria-pressed={mode === "bridge"} disabled={busy} onClick={() => setMode("bridge")}><ArrowDownLeft className="h-4 w-4" />Bridge to Arc</Button></div>
      <form className="space-y-5" onSubmit={event => { event.preventDefault(); void run(async () => {
        const current = await flags.refetch();
        if (current.error || current.data?.arc.enabled !== true) throw new Error("Arc wallet access is unavailable.");
        setReceipt(null);
        if (mode === "send") {
          const result = provider === "openpay" ? await submitOpenPayArcTransfer(await prepareFn({ data: { address, amount, recipient } }), amount, recipient, address, walletProvider ?? undefined) : await arcPayment(amount, recipient, walletProvider ?? undefined);
          setReceipt({ state: result.state, amount, network: "Arc Mainnet", transactions: result.txHash ? [{ hash: result.txHash, url: `https://explorer.arc.io/tx/${result.txHash}` }] : [] });
        }
        else { const result = await bridgeToArc(amount, source, walletProvider ?? undefined); setReceipt({ state: result.state, amount, network: `${source} → Arc`, transactions: result.steps.flatMap(step => step.txHash ? [{ hash: step.txHash, url: step.explorerUrl }] : []) }); }
        void balance.refetch();
        if (signedIn) void partner.refetch();
      }); }}>
        {mode === "send" && <div className="space-y-2"><Label>Payment provider</Label><Select value={provider} disabled={busy} onValueChange={value => { if (value === "circle" || value === "openpay") setProvider(value); }}><SelectTrigger aria-label="Payment provider"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="circle">Circle App Kit</SelectItem><SelectItem value="openpay" disabled={!signedIn || !linked}>OpenPay Arc{!linked ? " · Link wallet first" : ""}</SelectItem></SelectContent></Select></div>}
        {mode === "send" ? <div className="space-y-2"><Label htmlFor="arc-recipient">Recipient wallet</Label><Input id="arc-recipient" placeholder="0x…" value={recipient} onChange={event => setRecipient(event.target.value)} required disabled={busy} /></div> : <div className="space-y-2"><Label>Source network</Label><Select value={source} disabled={busy} onValueChange={value => { if (value === "Base" || value === "Ethereum" || value === "Arbitrum") setSource(value); }}><SelectTrigger aria-label="Source network"><SelectValue /></SelectTrigger><SelectContent>{["Base", "Ethereum", "Arbitrum"].map(network => <SelectItem key={network} value={network}>{network}</SelectItem>)}</SelectContent></Select></div>}
        <div className="space-y-2"><Label htmlFor="arc-amount">Amount (USDC)</Label><Input id="arc-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={event => setAmount(event.target.value)} required disabled={busy} /></div>
        <p className="text-sm text-muted-foreground">{mode === "send" ? "Arc Mainnet → recipient wallet" : `${source} → your Arc Mainnet wallet`} · Network fees apply. USDC in this wallet is separate from your OpenPay Pro balance.</p>
        <Button type="submit" disabled={busy || !accessEnabled} className="w-full">{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Awaiting wallet / network</> : "Review in wallet"}</Button>
      </form>
      {receipt && <div role="status" className="border-t border-border pt-5"><h2 className="text-lg font-semibold">{receipt.state === "success" ? "Transfer confirmed" : receipt.state === "error" ? "Transfer incomplete" : "Transfer pending"}</h2><p className="mt-1 text-sm text-muted-foreground">{receipt.amount} USDC · {receipt.network}</p>{receipt.transactions.map(transaction => transaction.url?.startsWith("https://") ? <a key={transaction.hash} href={transaction.url} target="_blank" rel="noopener noreferrer" className="mt-3 block break-all text-sm text-primary underline">{transaction.hash}</a> : <p key={transaction.hash} className="mt-3 break-all font-mono text-sm">{transaction.hash}</p>)}</div>}
    </section>}
    {address && signedIn && <section className="space-y-4 border-t border-border pt-6">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">OpenPay Arc</h2><Button size="icon" variant="ghost" aria-label="Refresh OpenPay Arc" disabled={partner.isFetching} onClick={() => void partner.refetch()}><RefreshCw className="h-4 w-4" /></Button></div>
      {partner.isPending ? <Loader2 aria-label="Loading OpenPay Arc balance" className="h-5 w-5 animate-spin" /> : partner.isError ? <p role="status" className="text-sm text-destructive">{partner.error.message}</p> : partner.data && <>
        <div className="flex flex-wrap justify-between gap-3"><p className="text-muted-foreground">USDC balance</p><p className="font-mono font-semibold">{partner.data.balance} USDC</p></div>
        {partner.data.savings && <dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-muted-foreground">Savings principal</dt><dd className="mt-1 font-mono">{partner.data.savings.principal} USDC</dd></div><div><dt className="text-muted-foreground">Savings interest</dt><dd className="mt-1 font-mono">{partner.data.savings.interest} USDC</dd></div></dl>}
        {partner.data.savingsUnavailable && <p role="status" className="text-sm text-muted-foreground">Savings position is currently unavailable.</p>}
        <p className="text-sm text-muted-foreground">Arc Mainnet · On-chain funds only</p>
      </>}
      <a href="https://openpayarc.lovable.app/developers" target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">OpenPay Arc developers</a>
    </section>}
  </div>;
}