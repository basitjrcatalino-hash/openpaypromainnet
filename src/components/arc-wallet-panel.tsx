import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, Copy, Download, ExternalLink, Link2, Loader2, QrCode, RefreshCw, ScanLine, Wallet } from "lucide-react";
import type { EIP1193Provider } from "viem";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrScannerButton } from "@/components/qr-scanner";
import { supabase } from "@/integrations/supabase/client";
import { arcBalance, arcPayment, arcTokenBalance, arcTokenTransfer, bridgeToArc, connectArcWallet, verifyArcWallet, submitOpenPayArcTransfer } from "@/lib/arc-wallet";
import { ArcConnectDialog } from "@/components/arc-connect-dialog";
import { getOpenPayArcSnapshot, prepareOpenPayArcPayment } from "@/lib/openpay-arc.functions";
import { fetchAuthMethodFlags } from "@/lib/auth-methods";
import { parsePaymentQr } from "@/lib/parse-payment-qr";
import { OUSD_LOGO_URL, USDC_LOGO_URL } from "@/lib/token-logos";
import { cn } from "@/lib/utils";

type Mode = "send" | "receive" | "bridge";
type Token = "USDC" | "OUSD";
const fmt = (v?: string) => (v == null ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 6 }));
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function ArcWalletPanel() {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [walletProvider, setWalletProvider] = useState<EIP1193Provider | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const afterConnect = useRef<((p: EIP1193Provider) => Promise<void>) | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [linked, setLinked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("send");
  const [token, setToken] = useState<Token>("USDC");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [provider, setProvider] = useState<"circle" | "openpay">("circle");
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const snapshotFn = useServerFn(getOpenPayArcSnapshot);
  const prepareFn = useServerFn(prepareOpenPayArcPayment);
  const [source, setSource] = useState<"Base" | "Ethereum" | "Arbitrum">("Base");
  const [receipt, setReceipt] = useState<{ state: string; amount: string; token: string; network: string; transactions: { hash: string; url?: string }[] } | null>(null);
  const flags = useQuery({ queryKey: ["auth-methods"], queryFn: () => fetchAuthMethodFlags(supabase), refetchInterval: 15_000 });
  const balance = useQuery({ queryKey: ["arc-balance", address], queryFn: () => address ? arcBalance(address) : Promise.resolve("0"), enabled: !!address, refetchInterval: 30_000 });
  const partner = useQuery({ queryKey: ["openpay-arc", address, signedIn], queryFn: () => { if (!address) throw new Error("Connect a wallet first."); return snapshotFn({ data: { address } }); }, enabled: !!address && signedIn && flags.data?.arc.enabled === true, refetchInterval: 30_000, retry: false });
  const ousdAddress = (partner.data?.network.ousd ?? null) as `0x${string}` | null;
  const ousd = useQuery({ queryKey: ["arc-ousd", address, ousdAddress], queryFn: () => arcTokenBalance(address!, ousdAddress!), enabled: !!address && !!ousdAddress, refetchInterval: 30_000 });

  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user)); }, []);
  useEffect(() => {
    setLinked(false);
    if (!address || !signedIn) return;
    void supabase.from("arc_wallet_links").select("address").eq("address", address.toLowerCase()).maybeSingle().then(({ data }) => setLinked(!!data));
  }, [address, signedIn]);
  useEffect(() => {
    if (!address) { setQr(null); return; }
    void QRCode.toDataURL(address, { margin: 1, width: 480, errorCorrectionLevel: "M" }).then(setQr);
  }, [address]);
  useEffect(() => { if (token === "OUSD") setProvider("circle"); }, [token]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await action(); } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }
  function requestConnect(next?: (p: EIP1193Provider) => Promise<void>) { afterConnect.current = next ?? null; setConnectOpen(true); }
  async function handleSelect(selected: EIP1193Provider) {
    setConnectOpen(false);
    await run(async () => {
      setWalletProvider(selected);
      setAddress(await connectArcWallet(selected));
      setReceipt(null);
      if (afterConnect.current) await afterConnect.current(selected);
    });
  }
  function onScan(text: string) {
    const parsed = parsePaymentQr(text);
    const to = parsed.to ?? "";
    if (!/^0x[a-fA-F0-9]{40}$/.test(to)) { toast.error("That QR isn't an Arc / EVM wallet address."); return; }
    setRecipient(to);
    if (parsed.amount) setAmount(String(parsed.amount));
    if (parsed.asset === "OUSD" && ousdAddress) setToken("OUSD");
    setMode("send");
    toast.success("Recipient filled from QR");
  }
  function copyAddress() {
    if (!address) return;
    void navigator.clipboard.writeText(address).then(() => { setCopied(true); toast.success("Address copied"); setTimeout(() => setCopied(false), 1500); });
  }

  const accessEnabled = flags.data?.arc.enabled === true && !flags.isError;
  const usdcText = !address ? "—" : balance.isError ? "Unavailable" : balance.isPending ? "…" : fmt(balance.data);
  const ousdText = !ousdAddress ? "—" : ousd.isError ? "Unavailable" : ousd.isPending ? "…" : fmt(ousd.data);
  const tokenBalance = token === "USDC" ? balance.data : ousd.data;

  const actions: { key: Mode | "scan"; label: string; icon: typeof ArrowUpRight }[] = [
    { key: "send", label: "Send", icon: ArrowUpRight },
    { key: "receive", label: "Receive", icon: ArrowDownLeft },
    { key: "scan", label: "Scan", icon: ScanLine },
    { key: "bridge", label: "Bridge", icon: ArrowLeftRight },
  ];

  return <div className="space-y-6">
    <ArcConnectDialog open={connectOpen} onOpenChange={setConnectOpen} busy={busy} onSelect={p => void handleSelect(p)} />

    {/* Balance card */}
    <section className="relative overflow-hidden rounded-3xl p-6 text-primary-foreground shadow-[var(--shadow-glow)]" style={{ backgroundImage: "var(--gradient-primary)" }}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-background/15 px-2.5 py-1 text-xs font-medium"><span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />Arc Mainnet</p>
          <p className="mt-4 text-sm opacity-80">Wallet balance</p>
          <p className="mt-1 truncate text-4xl font-semibold tabular-nums sm:text-5xl">{usdcText}<span className="ml-2 text-lg font-medium opacity-80">USDC</span></p>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 rounded-full bg-background/15 text-primary-foreground hover:bg-background/25 hover:text-primary-foreground" aria-label="Refresh balances" disabled={!address || balance.isFetching} onClick={() => { void balance.refetch(); void ousd.refetch(); void partner.refetch(); }}><RefreshCw className={cn("h-4 w-4", balance.isFetching && "animate-spin")} /></Button>
      </div>
      {address ? <button type="button" onClick={copyAddress} className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-background/15 px-3 py-1.5 font-mono text-sm transition hover:bg-background/25">
        <span className="truncate">{short(address)}</span>{copied ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
      </button> : <p className="mt-4 text-sm opacity-80">Connect a wallet to see your Arc balance.</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" className="rounded-full" disabled={busy || !accessEnabled} onClick={() => requestConnect()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}{address ? "Change wallet" : "Connect wallet"}</Button>
        {signedIn && address && <Button size="sm" variant="ghost" className="rounded-full bg-background/15 text-primary-foreground hover:bg-background/25 hover:text-primary-foreground" disabled={busy || linked || !accessEnabled} onClick={() => void run(async () => { const verified = await verifyArcWallet("link", walletProvider ?? undefined); setAddress(verified); setLinked(true); toast.success("Wallet linked to your existing account"); })}>{linked ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}{linked ? "Linked" : "Link to account"}</Button>}
        {!signedIn && <Button size="sm" variant="ghost" className="rounded-full bg-background/15 text-primary-foreground hover:bg-background/25 hover:text-primary-foreground" disabled={busy || !accessEnabled} onClick={() => requestConnect(async p => { await verifyArcWallet("login", p); window.location.assign("/dashboard"); })}>Sign in with wallet</Button>}
      </div>
    </section>

    {!signedIn && <p className="text-sm text-muted-foreground">Existing account? <Link to="/auth" search={{ next: "/arc" }} className="text-primary underline">Sign in to link your wallet</Link> · <Link to="/auth" search={{ method: "arc", mode: "signup", next: "/arc" }} className="text-primary underline">Create account</Link></p>}
    {(flags.isError || (!flags.isPending && !accessEnabled)) && <p role="status" className="text-sm text-destructive">Arc wallet access is currently unavailable.</p>}

    {address && <>
      {/* Actions */}
      <div className="grid grid-cols-4 gap-2">
        {actions.map(a => {
          const active = a.key === mode;
          const inner = <span className="flex flex-col items-center gap-2">
            <span className={cn("grid h-12 w-12 place-items-center rounded-2xl transition", active ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]" : "bg-muted text-foreground")}><a.icon className="h-5 w-5" /></span>
            <span className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>{a.label}</span>
          </span>;
          if (a.key === "scan") return <QrScannerButton key="scan" onResult={onScan} hint="Scan an Arc / EVM wallet QR (0x…)" trigger={<button type="button" className="rounded-2xl py-1 disabled:opacity-50" disabled={busy}>{inner}</button>} />;
          return <button key={a.key} type="button" disabled={busy} aria-pressed={active} onClick={() => { setMode(a.key as Mode); setReceipt(null); }} className="rounded-2xl py-1 disabled:opacity-50">{inner}</button>;
        })}
      </div>

      {/* Assets */}
      <section className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <p className="px-4 pt-4 text-sm font-medium text-muted-foreground">Assets on Arc</p>
        {([["USDC", USDC_LOGO_URL, usdcText, "USD Coin"], ["OUSD", OUSD_LOGO_URL, ousdText, ousdAddress ? "OpenUSD" : signedIn ? "OpenUSD · not on Arc yet" : "OpenUSD · sign in to load"]] as const).map(([sym, logo, val, name]) =>
          <button key={sym} type="button" disabled={sym === "OUSD" && !ousdAddress} onClick={() => { setToken(sym); setMode("send"); }} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-transparent">
            <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-full" />
            <span className="min-w-0"><span className="block font-semibold">{sym}</span><span className="block truncate text-sm text-muted-foreground">{name}</span></span>
            <span className="font-mono font-semibold tabular-nums">{val}</span>
          </button>)}
      </section>

      {/* Panels */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        {mode === "receive" ? <div className="flex flex-col items-center text-center">
          <h2 className="text-lg font-semibold">Receive USDC or OUSD</h2>
          <p className="mt-1 text-sm text-muted-foreground">Only send Arc Mainnet assets to this address.</p>
          <div className="mt-5 rounded-2xl bg-background p-3 ring-1 ring-border">{qr ? <img src={qr} alt="Wallet address QR code" className="h-56 w-56 rounded-lg bg-primary-foreground" /> : <div className="grid h-56 w-56 place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}</div>
          <p className="mt-4 max-w-full break-all font-mono text-sm">{address}</p>
          <div className="mt-4 grid w-full grid-cols-2 gap-2">
            <Button variant="outline" onClick={copyAddress}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}Copy</Button>
            <Button variant="outline" disabled={!qr} onClick={() => { if (!qr) return; const a = document.createElement("a"); a.href = qr; a.download = `arc-wallet-${address.slice(2, 8)}.png`; a.click(); }}><Download className="h-4 w-4" />Save QR</Button>
          </div>
        </div> : <form className="space-y-5" onSubmit={event => { event.preventDefault(); void run(async () => {
          const current = await flags.refetch();
          if (current.error || current.data?.arc.enabled !== true) throw new Error("Arc wallet access is unavailable.");
          setReceipt(null);
          if (mode === "send") {
            let result: { state: string; txHash?: string };
            if (token === "OUSD") { if (!ousdAddress) throw new Error("OUSD is not available on Arc yet."); result = await arcTokenTransfer(ousdAddress, amount, recipient, walletProvider ?? undefined); }
            else result = provider === "openpay" ? await submitOpenPayArcTransfer(await prepareFn({ data: { address, amount, recipient } }), amount, recipient, address, walletProvider ?? undefined) : await arcPayment(amount, recipient, walletProvider ?? undefined);
            setReceipt({ state: result.state, amount, token, network: "Arc Mainnet", transactions: result.txHash ? [{ hash: result.txHash, url: `https://explorer.arc.io/tx/${result.txHash}` }] : [] });
          } else {
            const result = await bridgeToArc(amount, source, walletProvider ?? undefined);
            setReceipt({ state: result.state, amount, token: "USDC", network: `${source} → Arc`, transactions: result.steps.flatMap(step => step.txHash ? [{ hash: step.txHash, url: step.explorerUrl }] : []) });
          }
          void balance.refetch(); void ousd.refetch();
          if (signedIn) void partner.refetch();
        }); }}>
          <h2 className="text-lg font-semibold">{mode === "send" ? `Send ${token}` : "Bridge USDC to Arc"}</h2>

          {mode === "send" ? <>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Token">
              {(["USDC", "OUSD"] as const).map(t => <button key={t} type="button" disabled={busy || (t === "OUSD" && !ousdAddress)} aria-pressed={token === t} onClick={() => setToken(t)} className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition disabled:opacity-40", token === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}><img src={t === "USDC" ? USDC_LOGO_URL : OUSD_LOGO_URL} alt="" className="h-5 w-5 rounded-full" />{t}</button>)}
            </div>
            <div className="space-y-2">
              <Label htmlFor="arc-recipient">Recipient wallet</Label>
              <div className="relative">
                <Input id="arc-recipient" placeholder="0x… address" value={recipient} onChange={event => setRecipient(event.target.value.trim())} required disabled={busy} className="pr-12 font-mono" />
                <QrScannerButton onResult={onScan} hint="Scan an Arc / EVM wallet QR (0x…)" trigger={<button type="button" aria-label="Scan recipient QR" className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-primary hover:bg-muted"><QrCode className="h-4 w-4" /></button>} />
              </div>
            </div>
            {token === "USDC" && <div className="space-y-2"><Label>Send via</Label><Select value={provider} disabled={busy} onValueChange={value => { if (value === "circle" || value === "openpay") setProvider(value); }}><SelectTrigger aria-label="Payment provider"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="circle">Circle App Kit</SelectItem><SelectItem value="openpay" disabled={!signedIn || !linked}>OpenPay Arc{!linked ? " · Link wallet first" : ""}</SelectItem></SelectContent></Select></div>}
          </> : <div className="space-y-2"><Label>From network</Label><Select value={source} disabled={busy} onValueChange={value => { if (value === "Base" || value === "Ethereum" || value === "Arbitrum") setSource(value); }}><SelectTrigger aria-label="Source network"><SelectValue /></SelectTrigger><SelectContent>{["Base", "Ethereum", "Arbitrum"].map(network => <SelectItem key={network} value={network}>{network}</SelectItem>)}</SelectContent></Select></div>}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2"><Label htmlFor="arc-amount">Amount</Label>{mode === "send" && <span className="text-sm text-muted-foreground">Available {fmt(tokenBalance)} {token}</span>}</div>
            <div className="relative">
              <Input id="arc-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={event => setAmount(event.target.value.replace(/[^\d.]/g, ""))} required disabled={busy} className="h-14 pr-24 text-2xl font-semibold tabular-nums" />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {mode === "send" && tokenBalance && <button type="button" onClick={() => setAmount(String(Math.floor(Number(tokenBalance) * 1e6) / 1e6))} className="rounded-md bg-primary/10 px-2 py-1 text-xs font-bold text-primary">MAX</button>}
                <span className="text-sm font-medium text-muted-foreground">{mode === "send" ? token : "USDC"}</span>
              </div>
            </div>
          </div>
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{mode === "send" ? "Arc Mainnet → recipient" : `${source} → your Arc wallet`} · Network fees paid in USDC. Funds in this wallet are separate from your OpenPay Pro balance.</p>
          <Button type="submit" size="lg" disabled={busy || !accessEnabled} className="w-full rounded-xl">{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Waiting for wallet…</> : "Review in wallet"}</Button>
        </form>}

        {receipt && mode !== "receive" && <div role="status" className="mt-5 rounded-xl border border-border p-4">
          <p className="font-semibold">{receipt.state === "success" ? "Transfer confirmed" : receipt.state === "error" ? "Transfer incomplete" : "Transfer pending"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{receipt.amount} {receipt.token} · {receipt.network}</p>
          {receipt.transactions.map(tx => tx.url?.startsWith("https://") ? <a key={tx.hash} href={tx.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 text-sm text-primary underline"><span className="truncate">{short(tx.hash)}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" /></a> : <p key={tx.hash} className="mt-2 break-all font-mono text-sm">{tx.hash}</p>)}
        </div>}
      </section>
    </>}

    {address && signedIn && <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">OpenPay Arc</h2><Button size="icon" variant="ghost" aria-label="Refresh OpenPay Arc" disabled={partner.isFetching} onClick={() => void partner.refetch()}><RefreshCw className="h-4 w-4" /></Button></div>
      {partner.isPending ? <Loader2 aria-label="Loading OpenPay Arc balance" className="h-5 w-5 animate-spin" /> : partner.isError ? <p role="status" className="text-sm text-destructive">{partner.error.message}</p> : partner.data && <>
        <div className="flex flex-wrap justify-between gap-3"><p className="text-muted-foreground">USDC balance</p><p className="font-mono font-semibold">{partner.data.balance} USDC</p></div>
        {partner.data.savings && <dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-muted-foreground">Savings principal</dt><dd className="mt-1 font-mono">{partner.data.savings.principal} USDC</dd></div><div><dt className="text-muted-foreground">Savings interest</dt><dd className="mt-1 font-mono">{partner.data.savings.interest} USDC</dd></div></dl>}
        {partner.data.savingsUnavailable && <p role="status" className="text-sm text-muted-foreground">Savings position is currently unavailable.</p>}
      </>}
      <a href="https://openpayarc.lovable.app/developers" target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">OpenPay Arc developers</a>
    </section>}
  </div>;
}
