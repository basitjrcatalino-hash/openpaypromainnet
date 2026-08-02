import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { notifySuccess } from "@/lib/notify-success";

import { Button } from "@/components/ui/button";
import { MerchantAvatar } from "@/components/p2p/P2pUi";
import { MerchantBadge } from "@/components/p2p/MerchantBadge";
import { P2pPayIcon } from "@/components/p2p/P2pPayIcon";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  fetchAd,
  fetchDisplayNames,
  fetchMerchants,
  fetchPaymentMethods,
  fetchTraderStats,
  fmtAmount,
  openOrder,
  p2pAmountExceedsLimit,
  p2pLimitError,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

type TakeSearch = { side?: "buy" | "sell" };

export const Route = createFileRoute("/_authenticated/p2p_/take/$adId")({
  validateSearch: (s: Record<string, unknown>): TakeSearch => ({
    side: s.side === "sell" ? "sell" : "buy",
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Place order — OpenPay Pro P2P` },
      { name: "description", content: `Confirm P2P trade amount and payment method for ad ${params.adId}.` },
    ],
  }),
  component: TakeOrderPage,
});

function TakeOrderPage() {
  const { adId } = Route.useParams();
  const { side } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { code: fiat } = useCurrency();

  const [inputMode, setInputMode] = useState<"crypto" | "fiat">("crypto");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [priceTick, setPriceTick] = useState(30);

  const adQ = useQuery({ queryKey: ["p2p-ad", adId], queryFn: () => fetchAd(adId) });
  const ad = adQ.data;

  const methodsQ = useQuery({ queryKey: ["p2p-methods"], queryFn: fetchPaymentMethods });
  const methodLabel = useMemo(() => {
    const m: Record<string, string> = {};
    for (const pm of methodsQ.data ?? []) m[pm.code] = pm.name;
    return m;
  }, [methodsQ.data]);

  const names = useQuery({
    queryKey: ["p2p-names", ad?.user_id],
    enabled: !!ad?.user_id,
    queryFn: () => fetchDisplayNames([ad!.user_id]),
  });
  const stats = useQuery({
    queryKey: ["p2p-stats", ad?.user_id],
    enabled: !!ad?.user_id,
    queryFn: () => fetchTraderStats([ad!.user_id]),
  });
  const merchants = useQuery({
    queryKey: ["p2p-merchants", ad?.user_id],
    enabled: !!ad?.user_id,
    queryFn: () => fetchMerchants([ad!.user_id]),
  });

  useEffect(() => {
    if (!ad) return;
    setAmount("");
    setMethod(ad.payment_methods[0] ?? "");
  }, [ad?.id]);

  useEffect(() => {
    const t = setInterval(() => setPriceTick((s) => (s <= 1 ? 30 : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    if (!ad || side !== "sell") {
      setBalance(null);
      return;
    }
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: w } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", data.user.id)
        .order("is_active", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive || !w) return;
      const key = `${ad.asset.toLowerCase()}_balance` as keyof typeof w;
      setBalance(Number(w[key] ?? 0));
    })();
    return () => {
      alive = false;
    };
  }, [ad, side]);

  const price = ad ? Number(ad.price_usd) : 0;
  const minCrypto = ad ? Number(ad.min_order) : 0;
  const maxCrypto = ad
    ? Math.min(Number(ad.max_order), Number(ad.available_amount))
    : 0;
  const maxForUser =
    side === "sell" && balance != null ? Math.min(maxCrypto, balance) : maxCrypto;

  const cryptoAmt = useMemo(() => {
    const n = Number(amount || 0);
    if (!(n > 0) || !price) return 0;
    return inputMode === "crypto" ? n : n / price;
  }, [amount, inputMode, price]);

  const fiatAmt = useMemo(() => {
    const n = Number(amount || 0);
    if (!(n > 0) || !price) return 0;
    return inputMode === "fiat" ? n : n * price;
  }, [amount, inputMode, price]);

  const overLimit = ad ? p2pAmountExceedsLimit(ad.asset, cryptoAmt, price) : false;
  const invalid =
    !ad ||
    !method ||
    !(cryptoAmt > 0) ||
    cryptoAmt < minCrypto ||
    cryptoAmt > maxForUser ||
    overLimit;

  const buy = useMutation({
    mutationFn: () => openOrder(adId, cryptoAmt, method),
    onSuccess: (order) => {
      notifySuccess("Escrow locked — trade started", { sound: "order" });
      void qc.invalidateQueries({ queryKey: ["p2p-ads"] });
      void navigate({ to: "/p2p/order/$id", params: { id: order.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const merchantName = ad ? (names.data?.[ad.user_id] ?? "Trader") : "…";
  const st = ad ? stats.data?.[ad.user_id] : undefined;
  const merch = ad ? merchants.data?.[ad.user_id] : undefined;

  function setMax() {
    if (!ad) return;
    if (inputMode === "crypto") setAmount(String(Number(maxForUser.toFixed(8))));
    else setAmount(String(Number((maxForUser * price).toFixed(2))));
  }

  if (adQ.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ad || ad.status !== "active") {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">This ad is no longer available.</p>
        <Button asChild className="rounded-full">
          <Link to="/p2p">Back to P2P</Link>
        </Button>
      </div>
    );
  }

  const title = `${side === "buy" ? "Buy" : "Sell"} ${ad.asset}`;
  const receiveLabel = side === "buy" ? "You'll pay" : "You'll receive";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background">
      <header
        className="sticky top-0 z-20 border-b border-border/30 bg-background/95 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex h-12 items-center gap-1 px-2">
          <button
            type="button"
            onClick={() => void navigate({ to: "/p2p" })}
            className="grid h-9 w-9 place-items-center rounded-full press"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center text-[17px] font-extrabold tracking-tight">{title}</h1>
          <span className="w-9" />
        </div>
      </header>

      <div className="flex-1 space-y-3 px-4 py-4 pb-28">
        {/* Amount card */}
        <section className="rounded-2xl bg-muted/40 p-4 dark:bg-muted/25">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex gap-4">
              {(["crypto", "fiat"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setInputMode(m);
                    setAmount("");
                  }}
                  className={cn(
                    "relative pb-1 text-[14px] font-bold capitalize",
                    inputMode === m ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {m === "crypto" ? "Crypto" : "Fiat"}
                  {inputMode === m ? (
                    <span className="absolute inset-x-0 -bottom-0.5 mx-auto h-0.5 w-full rounded-full bg-foreground" />
                  ) : null}
                </button>
              ))}
            </div>
            <p className="text-[12px] font-semibold tabular-nums text-muted-foreground">
              Price{" "}
              <span className="text-foreground">
                {formatCurrency(price, fiat as never, { compact: false })}
              </span>
              <span className="ml-1.5 text-[#00B2B2]">{String(priceTick).padStart(2, "0")}s</span>
            </p>
          </div>

          <div className="flex items-end gap-2 border-b border-border/40 pb-2">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder={
                inputMode === "crypto"
                  ? `Min. ${fmtAmount(minCrypto)}`
                  : `Min. ${formatCurrency(minCrypto * price, fiat as never, { compact: false })}`
              }
              className="min-w-0 flex-1 bg-transparent text-[28px] font-extrabold tabular-nums outline-none placeholder:text-muted-foreground/45"
            />
            <span className="mb-1 shrink-0 text-[15px] font-bold text-foreground">
              {inputMode === "crypto" ? ad.asset : fiat}
            </span>
            <button
              type="button"
              onClick={setMax}
              className="mb-1 shrink-0 rounded-md px-2 py-0.5 text-[13px] font-bold text-[#00B2B2] press"
            >
              Max
            </button>
          </div>

          <p className="mt-2 text-[11px] text-muted-foreground">
            Limit {fmtAmount(minCrypto)} – {fmtAmount(maxCrypto)} {ad.asset}
          </p>
          {side === "sell" ? (
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                Available balance{" "}
                {balance != null ? (
                  <span className="font-semibold text-foreground">
                    {fmtAmount(balance)} {ad.asset}
                  </span>
                ) : (
                  "…"
                )}
              </span>
              <Link to="/p2p/wallet" className="font-bold text-[#00B2B2]">
                Transfer
              </Link>
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Available on ad{" "}
              <span className="font-semibold text-foreground">
                {fmtAmount(ad.available_amount)} {ad.asset}
              </span>
            </p>
          )}

          {overLimit ? (
            <p className="mt-2 text-[11px] font-semibold text-[#FF2D55]">{p2pLimitError(ad.asset)}</p>
          ) : null}

          <div className="mt-4 flex items-baseline justify-between gap-2 border-t border-border/30 pt-3">
            <span className="text-[13px] font-semibold text-muted-foreground">{receiveLabel}</span>
            <span className="text-[17px] font-extrabold tabular-nums">
              {fiatAmt > 0
                ? formatCurrency(fiatAmt, fiat as never, { compact: false })
                : "—"}
            </span>
          </div>
        </section>

        {/* Payment method */}
        <section className="rounded-2xl bg-muted/40 p-4 dark:bg-muted/25">
          <p className="mb-2 text-[12px] font-semibold text-muted-foreground">Payment method</p>
          <div className="space-y-1.5">
            {ad.payment_methods.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setMethod(code)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold press",
                  method === code ? "bg-background shadow-sm" : "hover:bg-background/60",
                )}
              >
                <P2pPayIcon code={code} name={methodLabel[code] ?? code} size="sm" />
                <span className="flex-1 truncate">{methodLabel[code] ?? code}</span>
                <span
                  className={cn(
                    "grid h-4 w-4 place-items-center rounded-full border",
                    method === code
                      ? "border-[#00B2B2] bg-[#00B2B2] text-white"
                      : "border-muted-foreground/40",
                  )}
                >
                  {method === code ? <span className="text-[9px]">✓</span> : null}
                </span>
              </button>
            ))}
          </div>
          {!ad.payment_methods.length ? (
            <p className="text-[12px] text-muted-foreground">No payment methods on this ad.</p>
          ) : null}
        </section>

        {/* Merchant */}
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left press"
          onClick={() => toast.message("Merchant profile coming soon")}
        >
          <MerchantAvatar name={merchantName} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="truncate text-[14px] font-bold">{merchantName}</p>
              {(merch?.has_verified_badge || (merch && merch.tier !== "none")) && (
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#00B2B2]" />
              )}
              <MerchantBadge merchant={merch} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Buy {st?.completed_count != null ? st.completed_count : "—"} · Sell — ·{" "}
              {ad.pay_time_limit_minutes} min
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Notes */}
        <section className="space-y-2 px-1">
          <h2 className="text-[14px] font-extrabold">Notes</h2>
          {ad.terms ? (
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground">
              {ad.terms}
            </p>
          ) : (
            <ul className="list-disc space-y-1.5 pl-4 text-[12px] leading-relaxed text-muted-foreground">
              <li>Orders cannot be canceled after the counterparty confirms payment.</li>
              <li>Verify payment receipt carefully before releasing crypto.</li>
              <li>KYC mismatches may lead to refund or cancellation under trading rules.</li>
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground">
            By continuing you accept the{" "}
            <Link to="/p2p/rules" className="font-semibold text-foreground underline-offset-2 hover:underline">
              Trading Rules
            </Link>{" "}
            and{" "}
            <Link
              to="/p2p/agreement"
              className="font-semibold text-foreground underline-offset-2 hover:underline"
            >
              User Agreement
            </Link>
            .
          </p>
        </section>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/30 bg-background/95 px-4 pt-3 backdrop-blur-xl"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-lg">
          <Button
            className={cn(
              "h-12 w-full rounded-xl text-[16px] font-bold text-white",
              side === "buy"
                ? "bg-[#11C66D] hover:bg-[#0FB461]"
                : "bg-[#FF2D55] hover:bg-[#E8254A]",
            )}
            disabled={invalid || buy.isPending}
            onClick={() => buy.mutate()}
          >
            {buy.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : title}
          </Button>
        </div>
      </div>
    </div>
  );
}
