/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Clock,
  Camera,
  Check,
  ChevronRight,
  Loader2,
  Send as SendIcon,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OusdIcon } from "@/components/ousd-icon";
import { PageHeader } from "@/components/wallet/PageHeader";
import { QrScannerButton } from "@/components/qr-scanner";
import { parsePaymentQr } from "@/lib/parse-payment-qr";
import { sendAsset } from "@/lib/transfer.functions";
import { sendViaOpenPay, resolveOpenPayAccount } from "@/lib/openpay-pro.functions";
import { formatNumber, formatUSD, shortAddress } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";
import { PI_NETWORK_LOGO_URL } from "@/lib/token-logos";
import { MAJOR_TOKENS } from "@/lib/major-tokens";
import {
  isSystemCounterparty,
  loadRecentRecipients,
  saveRecentRecipient,
  type RecentRecipient,
} from "@/lib/recent-recipients";

const sendSearchSchema = z.object({
  to: z.string().optional(),
  amount: z.string().optional(),
  asset: z.enum(["OUSD", "PI", "BTC", "ETH", "SOL"]).optional(),
  token: z.string().uuid().optional(),
  rail: z.enum(["wallet", "openpay"]).optional(),
});

export const Route = createFileRoute("/_authenticated/send")({
  head: () => ({ meta: [{ title: "Send — OpenPay Pro Wallet" }] }),
  validateSearch: (search) => sendSearchSchema.parse(search),
  component: SendPage,
});

type Rail = "wallet" | "openpay";
type Step = "asset" | "recipient" | "amount" | "review";

type SendableAsset = {
  key: string;
  kind: "OUSD" | "PI" | "BTC" | "ETH" | "SOL" | "TOKEN";
  tokenId?: string;
  name: string;
  symbol: string;
  balance: number;
  priceUsd: number;
  logoUrl: string | null;
};

type HoldingRow = {
  balance: number;
  tokens: {
    id: string;
    name: string;
    symbol: string;
    price_usd: number | null;
    logo_url: string | null;
  } | null;
};

function SendPage() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const send = useServerFn(sendAsset);
  const sendOpenPay = useServerFn(sendViaOpenPay);
  const resolveOP = useServerFn(resolveOpenPayAccount);

  const [step, setStep] = useState<Step>("asset");
  const [busy, setBusy] = useState(false);
  const [rail, setRail] = useState<Rail>(search.rail === "openpay" ? "openpay" : "wallet");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [to, setTo] = useState(search.to ?? "");
  const [amount, setAmount] = useState(search.amount ?? "");
  const [memo, setMemo] = useState("");
  const [opPreview, setOpPreview] = useState<{
    name?: string;
    username?: string;
    account_number?: string;
  } | null>(null);
  const [opError, setOpError] = useState<string | null>(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () =>
      (
        await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  const { data: holdings = [], isLoading: holdingsLoading } = useQuery({
    queryKey: ["holdings", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async (): Promise<HoldingRow[]> => {
      const { data } = await supabase
        .from("token_holdings")
        .select("balance, tokens:token_id(id, name, symbol, price_usd, logo_url)")
        .eq("wallet_id", wallet!.id);
      return (data ?? []) as HoldingRow[];
    },
  });

  const { data: deepToken } = useQuery({
    queryKey: ["send-deep-token", search.token],
    enabled: !!search.token,
    queryFn: async () => {
      const { data } = await supabase
        .from("tokens")
        .select("id, name, symbol, price_usd, logo_url")
        .eq("id", search.token!)
        .maybeSingle();
      return data;
    },
  });

  const { data: recentRecipients = [] } = useQuery({
    queryKey: ["recent-recipients", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async (): Promise<RecentRecipient[]> => {
      const local = loadRecentRecipients();
      const { data } = await supabase
        .from("transactions")
        .select("counterparty, created_at")
        .eq("wallet_id", wallet!.id)
        .eq("type", "send")
        .not("counterparty", "is", null)
        .order("created_at", { ascending: false })
        .limit(40);
      const fromTx: RecentRecipient[] = [];
      const seen = new Set(local.map((r) => r.address.toLowerCase()));
      for (const row of data ?? []) {
        const cp = row.counterparty as string;
        if (isSystemCounterparty(cp)) continue;
        const key = cp.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        fromTx.push({
          address: cp,
          at: new Date(row.created_at as string).getTime(),
        });
      }
      return [...local, ...fromTx].slice(0, 8);
    },
  });

  const assets = useMemo((): SendableAsset[] => {
    const list: SendableAsset[] = [
      {
        key: "OUSD",
        kind: "OUSD",
        name: "OpenUSD OUSD",
        symbol: "OUSD",
        balance: Number(wallet?.ousd_balance ?? 0),
        priceUsd: 1,
        logoUrl: null,
      },
    ];
    const majors: Array<{
      key: "BTC" | "ETH" | "SOL" | "PI";
      kind: "BTC" | "ETH" | "SOL" | "PI";
      name: string;
      bal: number;
      price: number;
      logo: string;
    }> = [
      {
        key: "BTC",
        kind: "BTC",
        name: MAJOR_TOKENS.btc.name,
        bal: Number(wallet?.btc_balance ?? 0),
        price: 65000,
        logo: MAJOR_TOKENS.btc.logoUrl,
      },
      {
        key: "ETH",
        kind: "ETH",
        name: MAJOR_TOKENS.eth.name,
        bal: Number(wallet?.eth_balance ?? 0),
        price: 1920,
        logo: MAJOR_TOKENS.eth.logoUrl,
      },
      {
        key: "SOL",
        kind: "SOL",
        name: MAJOR_TOKENS.sol.name,
        bal: Number(wallet?.sol_balance ?? 0),
        price: 74,
        logo: MAJOR_TOKENS.sol.logoUrl,
      },
      {
        key: "PI",
        kind: "PI",
        name: MAJOR_TOKENS.pi.name,
        bal: Number(wallet?.pi_balance ?? 0),
        price: 0.079,
        logo: PI_NETWORK_LOGO_URL,
      },
    ];
    for (const m of majors) {
      if (m.bal > 0 || search.asset === m.key) {
        list.push({
          key: m.key,
          kind: m.kind,
          name: m.name,
          symbol: m.key,
          balance: m.bal,
          priceUsd: m.price,
          logoUrl: m.logo,
        });
      }
    }
    const seen = new Set<string>();
    for (const h of holdings) {
      const t = h.tokens;
      const bal = Number(h.balance ?? 0);
      if (!t?.id || bal <= 0) continue;
      seen.add(t.id);
      list.push({
        key: `TOKEN:${t.id}`,
        kind: "TOKEN",
        tokenId: t.id,
        name: t.name || t.symbol,
        symbol: t.symbol,
        balance: bal,
        priceUsd: Number(t.price_usd ?? 0),
        logoUrl: t.logo_url,
      });
    }
    // Deep-linked token from asset page even if balance is 0
    if (deepToken?.id && !seen.has(deepToken.id)) {
      const hold = holdings.find((h) => h.tokens?.id === deepToken.id);
      list.push({
        key: `TOKEN:${deepToken.id}`,
        kind: "TOKEN",
        tokenId: deepToken.id,
        name: deepToken.name || deepToken.symbol,
        symbol: deepToken.symbol,
        balance: Number(hold?.balance ?? 0),
        priceUsd: Number(deepToken.price_usd ?? 0),
        logoUrl: deepToken.logo_url,
      });
    }
    return list;
  }, [
    wallet?.ousd_balance,
    wallet?.pi_balance,
    wallet?.btc_balance,
    wallet?.eth_balance,
    wallet?.sol_balance,
    holdings,
    deepToken,
    search.asset,
  ]);

  const selected = assets.find((a) => a.key === selectedKey) ?? null;
  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const insufficient = selected ? amountValid && amountNum > selected.balance + 1e-12 : false;
  const usdEstimate =
    selected && amountValid ? amountNum * (selected.priceUsd > 0 ? selected.priceUsd : 0) : 0;

  // Deep-link: preselect asset / token and jump to recipient
  useEffect(() => {
    if (deepLinkHandled || holdingsLoading) return;
    if (!search.token && !search.asset && !search.to && !search.amount && !search.rail) {
      setDeepLinkHandled(true);
      return;
    }

    if (search.rail === "openpay") setRail("openpay");
    else if (search.rail === "wallet") setRail("wallet");

    if (search.token) {
      const key = `TOKEN:${search.token}`;
      const found = assets.find((a) => a.key === key);
      if (found || assets.length > 0) {
        setSelectedKey(key);
        setStep("recipient");
        setDeepLinkHandled(true);
      }
      return;
    }

    if (search.asset) {
      setSelectedKey(search.asset);
      setStep("recipient");
      setDeepLinkHandled(true);
      return;
    }

    if (search.to) {
      setSelectedKey("OUSD");
      setStep("recipient");
      setDeepLinkHandled(true);
      return;
    }

    setDeepLinkHandled(true);
  }, [search.token, search.asset, search.to, search.amount, search.rail, assets, holdingsLoading, deepLinkHandled]);

  // After deep-link / scan into OpenPay rail, resolve account preview
  useEffect(() => {
    if (!deepLinkHandled) return;
    if (rail !== "openpay") return;
    if (!to.trim()) return;
    if (opPreview || opError) return;
    void verifyOpenPay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkHandled, rail, to]);

  useEffect(() => {
    if (selected?.kind !== "OUSD" && rail === "openpay") setRail("wallet");
  }, [selected?.kind, rail]);

  function pickAsset(asset: SendableAsset) {
    setSelectedKey(asset.key);
    setAmount("");
    setMemo("");
    setRail("wallet");
    setStep("recipient");
  }

  function applyScan(text: string) {
    const p = parsePaymentQr(text);
    if (!p.to) {
      toast.error("Invalid QR — no address or account found");
      return;
    }
    setTo(p.to);
    setOpPreview(null);
    setOpError(null);
    if (p.amount) setAmount(p.amount);
    if (p.asset && (p.asset === "OUSD" || p.asset === "PI" || p.asset === "BTC" || p.asset === "ETH" || p.asset === "SOL")) {
      setSelectedKey(p.asset);
    }
    // Auto-select rail from QR type (Pro wallet vs OpenPay)
    if (p.rail === "openpay") {
      if (selected?.kind && selected.kind !== "OUSD") {
        setSelectedKey("OUSD");
      } else if (!selectedKey || selectedKey === "PI") {
        setSelectedKey("OUSD");
      }
      setRail("openpay");
      toast.success("OpenPay account scanned");
      // Resolve preview after state settles
      window.setTimeout(() => {
        void (async () => {
          try {
            const identifier = p.to.trim().replace(/^@+/, "");
            const r = await resolveOP({ data: { identifier } });
            if (r.ok) setOpPreview(r.account);
            else setOpError(r.error);
          } catch (e) {
            setOpError((e as Error).message);
          }
        })();
      }, 0);
    } else {
      setRail("wallet");
      toast.success(
        p.kind === "pro_wallet" ? "OpenPay Pro wallet scanned" : "QR scanned",
      );
    }
  }

  async function verifyOpenPay() {
    if (!to.trim()) return;
    setOpError(null);
    setOpPreview(null);
    try {
      const identifier = to.trim().replace(/^@+/, "");
      const r = await resolveOP({ data: { identifier } });
      if (r.ok) {
        setOpPreview(r.account);
        if (identifier !== to.trim()) setTo(identifier);
      } else setOpError(r.error);
    } catch (e) {
      setOpError((e as Error).message);
    }
  }

  function goBack() {
    if (step === "asset") {
      navigate({ to: "/dashboard" });
      return;
    }
    if (step === "recipient") {
      setStep("asset");
      return;
    }
    if (step === "amount") {
      setStep("recipient");
      return;
    }
    setStep("amount");
  }

  function continueFromRecipient() {
    if (!to.trim()) {
      toast.error(rail === "openpay" ? "Enter OpenPay account" : "Enter recipient");
      return;
    }
    if (rail === "openpay" && !opPreview && !opError) {
      void verifyOpenPay().then(() => setStep("amount"));
      return;
    }
    setStep("amount");
  }

  function continueFromAmount() {
    if (!selected) return;
    if (!amountValid) {
      toast.error("Enter an amount");
      return;
    }
    if (insufficient) {
      toast.error(`Insufficient ${selected.symbol}`);
      return;
    }
    setStep("review");
  }

  async function confirmSend() {
    if (!selected || !wallet || !amountValid) return;
    setBusy(true);
    try {
      if (rail === "openpay") {
        if (selected.kind !== "OUSD") throw new Error("OpenPay rail supports OUSD only");
        await sendOpenPay({
          data: { to: to.trim(), amount: amountNum, note: memo || null },
        });
        toast.success(`Sent ${formatNumber(amountNum, 4)} OUSD via OpenPay`);
      } else {
        if (to.trim().toLowerCase() === wallet.address.toLowerCase()) {
          toast.error("Cannot send to your own address");
          return;
        }
        const payload =
          selected.kind === "TOKEN"
            ? {
                to: to.trim(),
                amount: amountNum,
                asset: "TOKEN" as const,
                tokenId: selected.tokenId!,
                memo: memo || null,
              }
            : {
                to: to.trim(),
                amount: amountNum,
                asset: selected.kind,
                memo: memo || null,
              };
        const res = await send({ data: payload });
        toast.success(
          res.credited
            ? `Sent ${formatNumber(amountNum, 6)} ${res.symbol ?? selected.symbol} — recipient credited`
            : `Sent ${formatNumber(amountNum, 6)} ${res.symbol ?? selected.symbol}`,
        );
      }

      saveRecentRecipient(to.trim(), opPreview?.username ?? opPreview?.name);
      qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
      qc.invalidateQueries({ queryKey: ["holdings", wallet.id] });
      qc.invalidateQueries({ queryKey: ["txs", wallet.id] });
      qc.invalidateQueries({ queryKey: ["recent-txs", wallet.id] });
      qc.invalidateQueries({ queryKey: ["recent-recipients", wallet.id] });
      qc.invalidateQueries({ queryKey: ["ledger-entries"] });
      qc.invalidateQueries({ queryKey: ["ledger-overview"] });
      if (selected.kind === "TOKEN" && selected.tokenId) {
        qc.invalidateQueries({ queryKey: ["ot-holding", selected.tokenId, wallet.id] });
      }

      setTo("");
      setAmount("");
      setMemo("");
      setOpPreview(null);
      setSelectedKey(null);
      setStep("asset");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Step, string> = {
    asset: "Select asset",
    recipient: "Send to",
    amount: "Enter amount",
    review: "Review",
  };

  return (
    <div className="ot-phantom ph-page min-h-[70vh] pb-8">
      <PageHeader title={titles[step]} onBack={goBack} />

      {step === "asset" && (
        <div className="space-y-2">
          <p className="mb-3 px-1 text-sm text-muted-foreground">
            Choose what you want to send from your wallet
          </p>
          {holdingsLoading && !wallet ? (
            <div className="grid place-items-center py-16 text-sm text-muted-foreground">
              <Loader2 className="mb-2 h-5 w-5 animate-spin" /> Loading assets…
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-card">
              {assets.map((a, i) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => pickAsset(a)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-muted/50",
                    i > 0 && "border-t border-border",
                  )}
                >
                  <AssetAvatar asset={a} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-foreground">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.symbol}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums text-foreground">
                      {formatNumber(a.balance, a.balance < 1 ? 6 : 4)}
                    </div>
                    <div className="text-xs tabular-nums text-muted-foreground">
                      {formatUSD(a.balance * (a.priceUsd || 0))}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
              {assets.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No assets to send yet
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === "recipient" && selected && (
        <div className="space-y-4">
          <SelectedChip asset={selected} onChange={() => setStep("asset")} />

          {selected.kind === "OUSD" && (
            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setRail("wallet")}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-xs font-semibold transition",
                  rail === "wallet"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Pro wallet
              </button>
              <button
                type="button"
                onClick={() => setRail("openpay")}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-xs font-semibold transition",
                  rail === "openpay"
                    ? "bg-[#0070BA] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                OpenPay balance
              </button>
            </div>
          )}

          <div className="rounded-3xl border border-border bg-card p-4">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {rail === "openpay" ? "OpenPay account (OP…)" : "Address or @username"}
            </label>
            <div className="flex gap-2">
              <Input
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setOpPreview(null);
                  setOpError(null);
                }}
                onBlur={rail === "openpay" ? verifyOpenPay : undefined}
                placeholder={rail === "openpay" ? "OP… or @username" : "0x… or @username"}
                className="h-12 rounded-2xl"
                autoFocus
              />
              <QrScannerButton
                onResult={applyScan}
                hint={
                  rail === "openpay"
                    ? "Scan OpenPay OP account, @username, or pay link"
                    : "Scan OpenPay Pro wallet address or payment QR"
                }
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 shrink-0 rounded-2xl"
                    aria-label="Scan QR"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                }
              />
            </div>
            {rail === "openpay" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Enter the recipient’s OpenPay account number starting with{" "}
                <span className="font-semibold text-foreground">OP</span>.
              </p>
            )}
            {rail === "openpay" && opPreview && (
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2.5 text-xs">
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="font-semibold text-foreground">
                    {opPreview.name ?? opPreview.username}
                  </div>
                  <div className="text-muted-foreground">
                    {opPreview.username ? `@${opPreview.username.replace(/^@/, "")}` : ""}{" "}
                    {opPreview.account_number ? `· ${opPreview.account_number}` : ""}
                  </div>
                </div>
              </div>
            )}
            {rail === "openpay" && opError && (
              <div className="mt-2 text-xs text-destructive">{opError}</div>
            )}
            {selected.kind === "TOKEN" && (
              <p className="mt-3 text-xs text-muted-foreground">
                OpenTokens can only be sent to another OpenPay Pro wallet.
              </p>
            )}
          </div>

          {recentRecipients.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Recent
              </div>
              <ul className="overflow-hidden rounded-2xl bg-card">
                {recentRecipients.map((r) => (
                  <li key={r.address}>
                    <button
                      type="button"
                      onClick={() => {
                        setTo(r.address);
                        setOpPreview(null);
                        setOpError(null);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left press hover:bg-muted/40"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                        {(r.label ?? r.address).replace(/^@/, "").slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        {r.label ? (
                          <>
                            <span className="block truncate text-sm font-semibold">{r.label}</span>
                            <span className="block truncate font-mono text-[11px] text-muted-foreground">
                              {shortAddress(r.address, 8, 6)}
                            </span>
                          </>
                        ) : (
                          <span className="block truncate font-mono text-sm font-semibold">
                            {shortAddress(r.address, 10, 8)}
                          </span>
                        )}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            type="button"
            className="h-12 w-full rounded-full text-base font-semibold"
            disabled={!to.trim()}
            onClick={continueFromRecipient}
          >
            Continue
          </Button>
        </div>
      )}

      {step === "amount" && selected && (
        <div className="space-y-5">
          <SelectedChip asset={selected} onChange={() => setStep("asset")} />

          <div className="rounded-3xl border border-border bg-card px-4 py-8 text-center">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="0"
              autoFocus
              className="w-full bg-transparent text-center text-5xl font-bold tabular-nums text-foreground outline-none placeholder:text-muted-foreground/40"
            />
            <div className="mt-2 text-sm text-muted-foreground">
              {amountValid ? `≈ ${formatUSD(usdEstimate)}` : selected.symbol}
            </div>
            {insufficient && (
              <div className="mt-2 text-sm text-destructive">Insufficient balance</div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Available{" "}
              <span className="font-semibold text-foreground">
                {formatNumber(selected.balance, selected.balance < 1 ? 6 : 4)} {selected.symbol}
              </span>
            </span>
            <button
              type="button"
              className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary"
              onClick={() => setAmount(String(selected.balance))}
            >
              Max
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Note (optional)
            </label>
            <Textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={140}
              rows={2}
              className="rounded-2xl"
              placeholder="Add a note"
            />
          </div>

          <Button
            type="button"
            className="h-12 w-full rounded-full text-base font-semibold"
            disabled={!amountValid || insufficient}
            onClick={continueFromAmount}
          >
            Continue
          </Button>
        </div>
      )}

      {step === "review" && selected && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-5 text-center">
            <AssetAvatar asset={selected} className="mx-auto mb-3 h-14 w-14" />
            <div className="text-3xl font-bold tabular-nums text-foreground">
              {formatNumber(amountNum, amountNum < 1 ? 6 : 4)} {selected.symbol}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{formatUSD(usdEstimate)}</div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <ReviewRow label="Asset" value={`${selected.name} (${selected.symbol})`} />
            <ReviewRow
              label="To"
              value={
                rail === "openpay"
                  ? opPreview?.account_number || to
                  : to.startsWith("0x")
                    ? shortAddress(to, 8, 6)
                    : to
              }
            />
            <ReviewRow
              label="Via"
              value={rail === "openpay" ? "OpenPay balance" : "OpenPay Pro wallet"}
              last={!memo.trim()}
            />
            {memo.trim() && <ReviewRow label="Note" value={memo.trim()} last />}
          </div>

          <Button
            type="button"
            disabled={busy}
            onClick={() => void confirmSend()}
            className={cn(
              "h-12 w-full rounded-full text-base font-semibold text-primary-foreground",
              rail === "openpay" ? "bg-[#0070BA] hover:opacity-90" : "bg-primary",
            )}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <SendIcon className="mr-2 h-4 w-4" />
            )}
            {rail === "openpay" ? "Send via OpenPay" : `Send ${selected.symbol}`}
          </Button>
        </div>
      )}
    </div>
  );
}

function SelectedChip({ asset, onChange }: { asset: SendableAsset; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 text-left transition hover:bg-muted/40"
    >
      <AssetAvatar asset={asset} className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{asset.symbol}</div>
        <div className="text-xs text-muted-foreground">
          {formatNumber(asset.balance, asset.balance < 1 ? 6 : 4)} available
        </div>
      </div>
      <span className="text-xs font-medium text-primary">Change</span>
    </button>
  );
}

function AssetAvatar({
  asset,
  className,
}: {
  asset: SendableAsset;
  className?: string;
}) {
  if (asset.kind === "OUSD") {
    return <OusdIcon className={cn("h-10 w-10", className)} />;
  }

  const src =
    asset.kind === "PI"
      ? PI_NETWORK_LOGO_URL
      : asset.kind === "BTC"
        ? asset.logoUrl || MAJOR_TOKENS.btc.logoUrl
        : asset.kind === "ETH"
          ? asset.logoUrl || MAJOR_TOKENS.eth.logoUrl
          : asset.kind === "SOL"
            ? asset.logoUrl || MAJOR_TOKENS.sol.logoUrl
            : asset.logoUrl;

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn("h-10 w-10 shrink-0 rounded-full object-cover bg-muted", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary",
        className,
      )}
    >
      {asset.symbol.slice(0, 2)}
    </div>
  );
}

function ReviewRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-4 py-3 text-sm",
        !last && "border-b border-border",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right font-medium text-foreground break-all">{value}</span>
    </div>
  );
}
