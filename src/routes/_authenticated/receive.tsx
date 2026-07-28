import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Copy,
  Check,
  QrCode,
  Share2,
  Download,
  Wallet as WalletIcon,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/wallet/PageHeader";
import { cn } from "@/lib/utils";
import {
  claimOpenPayInbound,
  createOpenPayReceiveLink,
  settleOpenPayInboundReceive,
} from "@/lib/openpay-pro.functions";
import { formatUSD, shortAddress } from "@/lib/wallet-utils";

export const Route = createFileRoute("/_authenticated/receive")({
  head: () => ({ meta: [{ title: "Receive — OpenPay Pro Wallet" }] }),
  validateSearch: (s: Record<string, unknown>): {
    openpay_in?: "1";
    openpay_cancel?: "1";
    openpay_tx?: string;
    openpay_ref?: string;
    amount?: string;
  } => {
    const out: {
      openpay_in?: "1";
      openpay_cancel?: "1";
      openpay_tx?: string;
      openpay_ref?: string;
      amount?: string;
    } = {};
    if (s.openpay_in) out.openpay_in = "1";
    if (s.openpay_cancel) out.openpay_cancel = "1";
    if (typeof s.openpay_tx === "string") out.openpay_tx = s.openpay_tx;
    if (typeof s.openpay_ref === "string") out.openpay_ref = s.openpay_ref;
    if (typeof s.amount === "string") out.amount = s.amount;
    return out;
  },
  component: ReceivePage,
});

function ReceivePage() {
  const { user } = Route.useRouteContext();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<"OUSD" | "PI">("OUSD");
  const [opAmount, setOpAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"wallet" | "openpay">("wallet");
  const [walletQrUrl, setWalletQrUrl] = useState<string>("");
  const [opQrUrl, setOpQrUrl] = useState<string>("");
  const [opLink, setOpLink] = useState<{
    pay_url: string;
    note: string;
    partner_username?: string;
    address?: string | null;
  } | null>(null);

  const createReceive = useServerFn(createOpenPayReceiveLink);
  const settleInbound = useServerFn(settleOpenPayInboundReceive);
  const claimInbound = useServerFn(claimOpenPayInbound);

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

  const payUri = wallet?.address
    ? `openpay:${wallet.address}?asset=${asset}${amount ? `&amount=${encodeURIComponent(amount)}` : ""}`
    : "";

  function clearReturnParams() {
    void navigate({
      to: "/receive",
      search: {},
      replace: true,
    });
  }

  // Use data-URL images instead of canvas so React doesn't fight qrcode DOM mutations.
  useEffect(() => {
    let cancelled = false;
    if (!payUri) {
      setWalletQrUrl((prev) => (prev ? "" : prev));
      return;
    }
    void QRCode.toDataURL(payUri, {
      width: 220,
      margin: 1,
      color: { dark: "#111111", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setWalletQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setWalletQrUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [payUri]);

  useEffect(() => {
    let cancelled = false;
    if (!opLink?.pay_url) {
      setOpQrUrl((prev) => (prev ? "" : prev));
      return;
    }
    void QRCode.toDataURL(opLink.pay_url, {
      width: 200,
      margin: 1,
      color: { dark: "#111111", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setOpQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setOpQrUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [opLink?.pay_url]);

  async function refreshBalances() {
    void qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
    void qc.invalidateQueries({ queryKey: ["txs", wallet?.id] });
    void qc.invalidateQueries({ queryKey: ["wallets", user.id] });
  }

  async function checkForPayment(opts: { silent?: boolean } = {}) {
    setBusy(true);
    try {
      const r = await claimInbound({ data: { note: opLink?.note } });
      if (r.credited > 0) {
        toast.success(`Received ${formatUSD(r.amount)} from OpenPay`);
        await refreshBalances();
      } else if (r.already > 0) {
        if (!opts.silent) toast.info("Payment already credited");
      } else if (!opts.silent) {
        toast.info("No new OpenPay payment found yet — try again in a moment");
      }
      return r;
    } catch (e) {
      if (!opts.silent) toast.error((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (search.openpay_cancel) {
      toast.error("OpenPay transfer canceled");
      clearReturnParams();
      return;
    }
    if (!search.openpay_in) return;

    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        let done = false;
        try {
          const c = await claimInbound({ data: { note: search.openpay_ref } });
          if (cancelled) return;
          if (c.credited > 0) {
            toast.success(`Received ${formatUSD(c.amount)} from OpenPay`);
            done = true;
          } else if (c.already > 0) {
            toast.info("Already credited");
            done = true;
          }
        } catch {
          /* fall through */
        }

        if (!done && !cancelled) {
          const amt = search.amount ? Number(search.amount) : undefined;
          const r = await settleInbound({
            data: {
              openpay_tx: search.openpay_tx,
              note: search.openpay_ref,
              amount: amt && amt > 0 ? amt : undefined,
            },
          });
          if (cancelled) return;
          if (r.credited) {
            toast.success(
              r.already ? "Already credited" : `Received ${formatUSD(Number(amt || 0))} from OpenPay`,
            );
          }
        }
        if (!cancelled) await refreshBalances();
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) {
          setBusy(false);
          clearReturnParams();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.openpay_in, search.openpay_cancel]);

  useEffect(() => {
    if (!opLink?.note) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      if (n > 20) {
        window.clearInterval(id);
        return;
      }
      void checkForPayment({ silent: true });
    }, 15000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opLink?.note]);

  async function copyAddr() {
    if (!wallet?.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      toast.success("Address copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }

  function downloadQR() {
    if (!walletQrUrl) {
      toast.error("QR not ready yet");
      return;
    }
    const a = document.createElement("a");
    a.href = walletQrUrl;
    a.download = `openpay-${wallet?.address?.slice(0, 8) ?? "wallet"}.png`;
    a.click();
  }

  async function share() {
    if (!payUri) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "OpenPay payment request", text: payUri });
        return;
      } catch {
        /* ignore cancel */
      }
    }
    try {
      await navigator.clipboard.writeText(payUri);
      toast.success("Payment link copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  async function makeOpenPayLink() {
    setBusy(true);
    try {
      const amt = opAmount ? Number(opAmount) : undefined;
      if (opAmount && (!(amt! > 0) || Number.isNaN(amt))) {
        toast.error("Enter a valid amount");
        return;
      }
      const res = await createReceive({
        data: {
          amount: amt,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      setOpLink(res);
      setTab("openpay");
      toast.success("OpenPay receive link ready — share it");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ot-phantom ph-page space-y-5 pb-8">
      <PageHeader title="Receive" backTo="/dashboard" />

      <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-1 rounded-2xl bg-muted/50 p-1">
        <button
          type="button"
          onClick={() => setTab("wallet")}
          className={cn(
            "rounded-xl px-2 py-2.5 text-xs font-semibold press",
            tab === "wallet" ? "bg-card text-foreground" : "text-muted-foreground",
          )}
        >
          Wallet QR
        </button>
        <button
          type="button"
          onClick={() => setTab("openpay")}
          className={cn(
            "rounded-xl px-2 py-2.5 text-xs font-semibold press",
            tab === "openpay" ? "bg-card text-foreground" : "text-muted-foreground",
          )}
        >
          From OpenPay
        </button>
      </div>

      {tab === "wallet" && (
        <div className="space-y-5">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{wallet?.name ?? "Main Wallet"}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">Scan to receive {asset}</p>
          </div>

          <div className="mx-auto grid w-fit place-items-center rounded-3xl bg-white p-5 shadow-sm">
            {walletQrUrl ? (
              <img
                src={walletQrUrl}
                alt={`Receive ${asset} QR`}
                width={220}
                height={220}
                className="block h-55 w-55"
              />
            ) : (
              <QrCode className="h-40 w-40 text-muted-foreground" aria-hidden />
            )}
          </div>

          <button
            type="button"
            onClick={() => void copyAddr()}
            className="mx-auto flex max-w-full items-center gap-2 rounded-full bg-muted px-4 py-2.5 font-mono text-xs text-foreground press"
          >
            <span className="truncate">{shortAddress(wallet?.address, 8, 8)}</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5 shrink-0" />
            )}
          </button>

          <div className="overflow-hidden rounded-2xl bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <span className="text-sm text-muted-foreground">Asset</span>
              <div className="flex gap-1 rounded-lg bg-muted/60 p-0.5" role="group" aria-label="Asset">
                {(["OUSD", "PI"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAsset(a)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold",
                      asset === a ? "bg-background text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <label htmlFor="receive-amount" className="text-sm text-muted-foreground">
                Amount
              </label>
              <Input
                id="receive-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Optional"
                inputMode="decimal"
                autoComplete="off"
                className="h-9 max-w-36 border-0 bg-transparent text-right font-semibold shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="secondary" className="h-12 rounded-full" onClick={() => void share()}>
              <Share2 className="mr-1.5 h-4 w-4" />
              Share
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-12 rounded-full"
              onClick={downloadQR}
              disabled={!walletQrUrl}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Save QR
            </Button>
          </div>
        </div>
      )}

      {tab === "openpay" && (
        <div className="space-y-5">
          <div className="text-center">
            <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
              <WalletIcon className="h-6 w-6" />
            </span>
            <p className="text-lg font-semibold text-foreground">Receive from OpenPay</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a link so someone can pay you from OpenPay
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl bg-card">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <label htmlFor="receive-op-amount" className="text-sm text-muted-foreground">
                Amount
              </label>
              <Input
                id="receive-op-amount"
                value={opAmount}
                onChange={(e) => setOpAmount(e.target.value)}
                placeholder="Optional"
                inputMode="decimal"
                autoComplete="off"
                className="h-9 max-w-36 border-0 bg-transparent text-right font-semibold shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <Button
            type="button"
            className="h-14 w-full rounded-full text-base font-semibold"
            disabled={busy}
            onClick={() => void makeOpenPayLink()}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create receive link
          </Button>

          {opLink && (
            <div className="space-y-4 overflow-hidden rounded-2xl bg-card p-4">
              <div className="mx-auto grid w-fit place-items-center rounded-2xl bg-white p-3">
                {opQrUrl ? (
                  <img
                    src={opQrUrl}
                    alt="OpenPay receive QR"
                    width={200}
                    height={200}
                    className="block h-50 w-50"
                  />
                ) : (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="break-all text-center font-mono text-[10px] text-muted-foreground">
                {opLink.note}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(opLink.pay_url);
                      toast.success("OpenPay link copied");
                    } catch {
                      toast.error("Copy failed");
                    }
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy link
                </Button>
                <Button asChild size="sm" className="rounded-full">
                  <a href={opLink.pay_url} target="_blank" rel="noreferrer">
                    Open
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={busy}
                  onClick={() => void checkForPayment()}
                >
                  {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Check payment
                </Button>
              </div>
              <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                Payer opens the link on OpenPay
                {opLink.partner_username ? ` (@${opLink.partner_username})` : ""}, then you are
                credited on Pro.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
