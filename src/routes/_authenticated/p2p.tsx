import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ShieldCheck, Store, Timer, Users } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/wallet/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  P2P_ASSETS,
  fetchAds,
  fetchDisplayNames,
  fetchPaymentMethods,
  fmtAmount,
  openOrder,
  type P2PAd,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p")({
  head: () => ({
    meta: [
      { title: "P2P Marketplace — OpenPay Pro" },
      {
        name: "description",
        content:
          "Buy and sell OUSD, USDT, USDC and more peer-to-peer with smart-contract style escrow, bank transfer, GCash, Maya, PayPal and Wise.",
      },
      { property: "og:title", content: "P2P Marketplace — OpenPay Pro" },
      {
        property: "og:description",
        content: "Escrow-protected peer-to-peer crypto trading on OpenPay Pro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: P2PMarketplace,
});

function P2PMarketplace() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [asset, setAsset] = useState<string>("OUSD");
  const [selected, setSelected] = useState<P2PAd | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Buying means matching against SELL ads; selling matches BUY ads.
  const adSide = side === "buy" ? "sell" : "buy";

  const methodsQ = useQuery({ queryKey: ["p2p-methods"], queryFn: fetchPaymentMethods });
  const adsQ = useQuery({
    queryKey: ["p2p-ads", adSide, asset],
    queryFn: () => fetchAds({ side: adSide, asset }),
    refetchInterval: 15_000,
  });

  const names = useQuery({
    queryKey: ["p2p-names", (adsQ.data ?? []).map((a) => a.user_id).join(",")],
    queryFn: () => fetchDisplayNames((adsQ.data ?? []).map((a) => a.user_id)),
    enabled: !!adsQ.data?.length,
  });

  const methodLabel = useMemo(() => {
    const m: Record<string, string> = {};
    for (const pm of methodsQ.data ?? []) m[pm.code] = `${pm.icon ?? ""} ${pm.name}`.trim();
    return m;
  }, [methodsQ.data]);

  const buy = useMutation({
    mutationFn: (v: { adId: string; amount: number; method: string }) =>
      openOrder(v.adId, v.amount, v.method),
    onSuccess: (order) => {
      toast.success("Escrow locked — trade started");
      void qc.invalidateQueries({ queryKey: ["p2p-ads"] });
      setSelected(null);
      void navigate({ to: "/p2p/order/$id", params: { id: order.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-24">
      <PageHeader
        title="P2P Marketplace"
        backTo="/dashboard"
        right={
          <Link
            to="/p2p/orders"
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground press"
          >
            My orders
          </Link>
        }
      />

      <div className="rounded-3xl border border-border/60 bg-card/70 p-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-[-0.02em]">
              Trade crypto peer-to-peer
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every trade is protected by escrow. Funds only move when both sides confirm.
            </p>
          </div>
          <Link
            to="/p2p/create"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground press"
          >
            <Plus className="h-4 w-4" /> Post ad
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full bg-muted/60 p-1">
            {(["buy", "sell"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={cn(
                  "h-9 rounded-full px-6 text-sm font-bold capitalize transition-colors",
                  side === s
                    ? s === "buy"
                      ? "bg-emerald-500 text-white"
                      : "bg-rose-500 text-white"
                    : "text-muted-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {P2P_ASSETS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAsset(a)}
                className={cn(
                  "h-8 rounded-full px-3 text-xs font-bold transition-colors",
                  asset === a
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/50">
        <div className="hidden grid-cols-12 gap-3 border-b border-border/60 px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground md:grid">
          <div className="col-span-3">Advertiser</div>
          <div className="col-span-2">Price</div>
          <div className="col-span-3">Available / Limits</div>
          <div className="col-span-2">Payment</div>
          <div className="col-span-2 text-right">Trade</div>
        </div>

        {adsQ.isLoading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !adsQ.data?.length ? (
          <div className="grid place-items-center gap-3 py-20 text-center">
            <Store className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No {side === "buy" ? "sell" : "buy"} ads for {asset} yet.
            </p>
            <Link
              to="/p2p/create"
              className="text-sm font-semibold text-primary underline underline-offset-4"
            >
              Post the first advertisement
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {adsQ.data.map((ad) => (
              <div key={ad.id} className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-12">
                <div className="col-span-3 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/12 text-sm font-black text-primary">
                    {(names.data?.[ad.user_id] ?? "T").slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {names.data?.[ad.user_id] ?? "Trader"}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Timer className="h-3 w-3" /> {ad.pay_time_limit_minutes} min
                    </p>
                  </div>
                </div>
                <div className="col-span-2 flex items-baseline gap-1">
                  <span className="text-lg font-extrabold tabular-nums">
                    ${fmtAmount(ad.price_usd)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">USD</span>
                </div>
                <div className="col-span-3 text-sm">
                  <p className="font-semibold tabular-nums">
                    {fmtAmount(ad.available_amount)} {ad.asset}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {fmtAmount(ad.min_order)} – {fmtAmount(ad.max_order)} {ad.asset}
                  </p>
                </div>
                <div className="col-span-2 flex flex-wrap gap-1">
                  {ad.payment_methods.slice(0, 3).map((code) => (
                    <span
                      key={code}
                      className="rounded-md bg-muted/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                    >
                      {methodLabel[code] ?? code}
                    </span>
                  ))}
                </div>
                <div className="col-span-2 flex items-center md:justify-end">
                  <Button
                    onClick={() => setSelected(ad)}
                    className={cn(
                      "h-9 w-full rounded-xl text-sm font-bold md:w-auto md:px-6",
                      side === "buy"
                        ? "bg-emerald-500 text-white hover:bg-emerald-500/90"
                        : "bg-rose-500 text-white hover:bg-rose-500/90",
                    )}
                  >
                    {side === "buy" ? "Buy" : "Sell"} {ad.asset}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/60 bg-card/40 px-5 py-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Escrow-protected settlement
        </span>
        <span className="inline-flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Moderator dispute resolution
        </span>
        <Link to="/p2p/orders" className="ml-auto font-semibold text-primary">
          Order history →
        </Link>
      </div>

      <BuyDialog
        ad={selected}
        side={side}
        methodLabel={methodLabel}
        onClose={() => setSelected(null)}
        pending={buy.isPending}
        onConfirm={(amount, method) =>
          selected && buy.mutate({ adId: selected.id, amount, method })
        }
      />
    </div>
  );
}

function BuyDialog({
  ad,
  side,
  methodLabel,
  onClose,
  onConfirm,
  pending,
}: {
  ad: P2PAd | null;
  side: "buy" | "sell";
  methodLabel: Record<string, string>;
  onClose: () => void;
  onConfirm: (amount: number, method: string) => void;
  pending: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("");
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!ad) return;
    setAmount(String(ad.min_order));
    setMethod(ad.payment_methods[0] ?? "");
  }, [ad]);

  // Selling requires the seller (you) to have the asset available for escrow.
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

  const amt = Number(amount || 0);
  const total = ad ? amt * Number(ad.price_usd) : 0;
  const invalid =
    !ad ||
    !method ||
    !(amt > 0) ||
    amt < Number(ad.min_order) ||
    amt > Math.min(Number(ad.max_order), Number(ad.available_amount)) ||
    (side === "sell" && balance != null && amt > balance);

  return (
    <Dialog open={!!ad} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {side === "buy" ? "Buy" : "Sell"} {ad?.asset}
          </DialogTitle>
          <DialogDescription>
            Price ${ad ? fmtAmount(ad.price_usd) : "0.00"} · limits{" "}
            {ad ? `${fmtAmount(ad.min_order)} – ${fmtAmount(ad.max_order)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Amount ({ad?.asset})</Label>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="h-12 text-lg font-bold tabular-nums"
            />
            {side === "sell" && balance != null ? (
              <p className="text-[11px] text-muted-foreground">
                Your balance: {fmtAmount(balance)} {ad?.asset}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <div className="flex flex-wrap gap-2">
              {(ad?.payment_methods ?? []).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setMethod(code)}
                  className={cn(
                    "h-9 rounded-xl border px-3 text-xs font-semibold",
                    method === code
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {methodLabel[code] ?? code}
                </button>
              ))}
            </div>
          </div>

          {ad?.terms ? (
            <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              <span className="font-bold text-foreground">Terms:</span> {ad.terms}
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
            <span className="text-sm text-muted-foreground">You pay</span>
            <span className="text-lg font-extrabold tabular-nums">${total.toFixed(2)}</span>
          </div>

          <Button
            className="h-12 w-full rounded-xl text-base font-bold"
            disabled={invalid || pending}
            onClick={() => onConfirm(amt, method)}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start escrow trade"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            {side === "buy"
              ? "Seller's crypto is locked in escrow before you pay."
              : "Your crypto is locked in escrow until the buyer pays."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
