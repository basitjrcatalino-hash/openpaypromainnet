import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BuySellToggle } from "@/components/p2p/P2pUi";
import { CurrencyPickerSheet } from "@/components/wallet/CurrencyPickerSheet";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  P2P_ASSETS,
  fetchAds,
  fetchPaymentMethods,
  fmtAmount,
  matchExpressAd,
  openOrder,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p_/express")({
  head: () => ({
    meta: [
      { title: "P2P Express — OpenPay Pro" },
      {
        name: "description",
        content: "Quick buy or sell crypto via the best matching P2P advertisement.",
      },
      { property: "og:title", content: "P2P Express — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExpressPage,
});

function ExpressPage() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [asset, setAsset] = useState("OUSD");
  const [cryptoAmt, setCryptoAmt] = useState("");
  const [fiatAmt, setFiatAmt] = useState("");
  const [method, setMethod] = useState<string | null>(null);
  const [assetOpen, setAssetOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [fiatOpen, setFiatOpen] = useState(false);
  const { code: fiat, setCode, meta } = useCurrency();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const adSide = side === "buy" ? "sell" : "buy";
  const adsQ = useQuery({
    queryKey: ["p2p-ads", adSide, asset],
    queryFn: () => fetchAds({ side: adSide, asset }),
    refetchInterval: 15_000,
  });
  const methodsQ = useQuery({ queryKey: ["p2p-methods"], queryFn: fetchPaymentMethods });
  const walletQ = useQuery({
    queryKey: ["express-wallet-bal", asset],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return 0;
      const { data: w } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", u.user.id)
        .order("is_active", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!w) return 0;
      const key = `${asset.toLowerCase()}_balance` as keyof typeof w;
      return Number(w[key] ?? 0);
    },
  });

  const bestPrice = Number(adsQ.data?.[0]?.price_usd ?? 1);

  const onCryptoChange = (v: string) => {
    const clean = v.replace(/[^0-9.]/g, "");
    setCryptoAmt(clean);
    const n = Number(clean);
    if (n > 0) setFiatAmt((n * bestPrice).toFixed(2));
    else setFiatAmt("");
  };
  const onFiatChange = (v: string) => {
    const clean = v.replace(/[^0-9.]/g, "");
    setFiatAmt(clean);
    const n = Number(clean);
    if (n > 0 && bestPrice > 0) setCryptoAmt((n / bestPrice).toFixed(6).replace(/\.?0+$/, ""));
    else setCryptoAmt("");
  };

  const amount = Number(cryptoAmt || 0);
  const matched = useMemo(
    () => matchExpressAd(adsQ.data ?? [], { amount, paymentMethod: method }),
    [adsQ.data, amount, method],
  );

  const limits = useMemo(() => {
    const ads = adsQ.data ?? [];
    if (!ads.length) return { min: 0, max: 0 };
    const mins = ads.map((a) => Number(a.min_order) * Number(a.price_usd));
    const maxs = ads.map(
      (a) => Math.min(Number(a.max_order), Number(a.available_amount)) * Number(a.price_usd),
    );
    return { min: Math.min(...mins), max: Math.max(...maxs) };
  }, [adsQ.data]);

  const start = useMutation({
    mutationFn: async () => {
      if (!matched) throw new Error("No matching advertisement for this amount");
      const pay = method ?? matched.payment_methods[0];
      if (!pay) throw new Error("Select a payment method");
      return openOrder(matched.id, amount, pay);
    },
    onSuccess: (order) => {
      toast.success("Escrow locked — trade started");
      void qc.invalidateQueries({ queryKey: ["p2p-ads"] });
      void navigate({ to: "/p2p/order/$id", params: { id: order.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canTrade = amount > 0 && !!matched && (method || matched.payment_methods[0]);

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-8 pt-3 md:max-w-xl lg:max-w-2xl md:px-6">
      <div className="mb-4 rounded-2xl border border-border/50 bg-card/50 p-4 md:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Hot crypto</h2>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Discover what people are trading now and get them easily on P2P.
        </p>
        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none md:flex-wrap md:overflow-visible">
          {P2P_ASSETS.slice(0, 4).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAsset(a)}
              className={cn(
                "min-w-[6.5rem] shrink-0 rounded-xl border px-3 py-2 text-left md:min-w-0 md:flex-1",
                asset === a ? "border-foreground bg-secondary" : "border-border/60 bg-background/40",
              )}
            >
              <p className="text-xs font-bold">{a}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">P2P live</p>
            </button>
          ))}
        </div>
      </div>

      <BuySellToggle value={side} onChange={setSide} className="mb-4 w-full justify-center [&_button]:flex-1" />

      <div className="space-y-3 rounded-2xl border border-border/50 bg-card/40 p-4">
        <div>
          <p className="text-xs text-muted-foreground">
            You {side === "buy" ? "buy" : "sell"}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Input
              inputMode="decimal"
              value={cryptoAmt}
              onChange={(e) => onCryptoChange(e.target.value)}
              placeholder="0"
              className="h-12 border-0 bg-transparent px-0 text-3xl font-extrabold tabular-nums shadow-none focus-visible:ring-0"
            />
            <button
              type="button"
              onClick={() => setAssetOpen(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-secondary px-3 text-sm font-bold"
            >
              {asset}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Available {fmtAmount(walletQ.data ?? 0)} {asset}
            {side === "buy" ? (
              <LinkManage />
            ) : null}
            {" · "}1 {asset} ≈ {formatCurrency(bestPrice, fiat as never, { compact: false })}
          </p>
        </div>

        <div className="border-t border-border/40 pt-3">
          <p className="text-xs text-muted-foreground">You {side === "buy" ? "pay" : "receive"}</p>
          <div className="mt-1 flex items-center gap-2">
            <Input
              inputMode="decimal"
              value={fiatAmt}
              onChange={(e) => onFiatChange(e.target.value)}
              placeholder="0"
              className="h-12 border-0 bg-transparent px-0 text-3xl font-extrabold tabular-nums shadow-none focus-visible:ring-0"
            />
            <button
              type="button"
              onClick={() => setFiatOpen(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-secondary px-3 text-sm font-bold"
            >
              {meta.code}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {formatCurrency(limits.min, fiat as never, { compact: false })} –{" "}
            {formatCurrency(limits.max, fiat as never, { compact: false })}
          </p>
        </div>
      </div>

      <Button
        className={cn(
          "mt-5 h-12 w-full rounded-full text-base font-bold",
          canTrade
            ? side === "buy"
              ? "bg-emerald-500 text-white hover:bg-emerald-500/90"
              : "bg-rose-500 text-white hover:bg-rose-500/90"
            : "bg-secondary text-muted-foreground",
        )}
        disabled={!canTrade || start.isPending}
        onClick={() => {
          if (!method && matched?.payment_methods[0]) {
            setMethodOpen(true);
            return;
          }
          start.mutate();
        }}
      >
        {start.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : method || matched ? (
          "Start escrow trade"
        ) : (
          "Select payment method"
        )}
      </Button>

      {matched ? (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Matched ad @ {formatCurrency(Number(matched.price_usd), fiat as never, { compact: false })}
        </p>
      ) : amount > 0 ? (
        <p className="mt-3 text-center text-[11px] text-rose-400">No ad matches this amount</p>
      ) : null}

      <CurrencyPickerSheet
        open={fiatOpen}
        onOpenChange={setFiatOpen}
        value={fiat}
        onSelect={setCode}
      />

      <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select crypto</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {P2P_ASSETS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setAsset(a);
                  setAssetOpen(false);
                }}
                className={cn(
                  "h-11 rounded-xl border text-sm font-bold",
                  asset === a ? "border-foreground bg-secondary" : "border-border",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={methodOpen} onOpenChange={setMethodOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select payment method</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {(methodsQ.data ?? [])
              .filter((m) => m.is_active)
              .filter((m) => !matched || matched.payment_methods.includes(m.code))
              .map((m) => (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => {
                    setMethod(m.code);
                    setMethodOpen(false);
                    if (matched && amount > 0) {
                      // proceed on next click; keep selected
                    }
                  }}
                  className={cn(
                    "h-9 rounded-xl border px-3 text-xs font-semibold",
                    method === m.code
                      ? "border-foreground bg-secondary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {m.icon} {m.name}
                </button>
              ))}
          </div>
          <Button
            className="mt-3 h-11 w-full rounded-full font-bold"
            disabled={!method || !matched || start.isPending}
            onClick={() => start.mutate()}
          >
            {start.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LinkManage() {
  return (
    <>
      {" · "}
      <Link to="/wallet" className="font-semibold text-sky-500">
        Manage funds
      </Link>
    </>
  );
}
