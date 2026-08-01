import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { P2pEmptyState } from "@/components/p2p/P2pUi";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import { P2P_ASSETS, createAd, fetchMyAds, fetchPaymentMethods, fmtAmount } from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p_/create")({
  head: () => ({
    meta: [
      { title: "P2P Ads — OpenPay Pro" },
      { name: "description", content: "Manage your P2P buy and sell advertisements." },
      { property: "og:title", content: "P2P Ads — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdsHubPage,
});

function AdsHubPage() {
  const [creating, setCreating] = useState(false);
  const { code: fiat } = useCurrency();
  const qc = useQueryClient();

  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const myAdsQ = useQuery({
    queryKey: ["p2p-my-ads", userQ.data],
    queryFn: () => fetchMyAds(userQ.data as string),
    enabled: !!userQ.data,
  });

  const toggleStatus = useMutation({
    mutationFn: async (v: { id: string; status: "active" | "paused" }) => {
      const { error } = await supabase.from("p2p_ads").update({ status: v.status }).eq("id", v.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["p2p-my-ads"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <header
        className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-border/40 bg-background/95 px-4 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <h1 className="text-lg font-bold">Ads</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="grid h-9 w-9 place-items-center rounded-full text-foreground press"
          aria-label="Create ad"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      {myAdsQ.isLoading ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !myAdsQ.data?.length ? (
        <P2pEmptyState
          title="No ads found"
          description="Create an ad to buy or sell crypto."
          action={
            <Button
              className="mt-2 h-10 rounded-full bg-secondary px-6 font-bold text-foreground"
              onClick={() => setCreating(true)}
            >
              Create ad
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-border/40">
          {myAdsQ.data.map((ad) => (
            <div key={ad.id} className="px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "text-sm font-bold capitalize",
                    ad.side === "sell" ? "text-rose-500" : "text-emerald-500",
                  )}
                >
                  {ad.side} {ad.asset}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                    ad.status === "active"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {ad.status}
                </span>
              </div>
              <p className="mt-2 text-xl font-extrabold tabular-nums">
                {formatCurrency(Number(ad.price_usd), fiat as never, { compact: false })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Available {fmtAmount(ad.available_amount)} / {fmtAmount(ad.total_amount)} {ad.asset}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {ad.payment_methods.join(", ") || "No methods"}
              </p>
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full"
                  disabled={toggleStatus.isPending || ad.status === "closed"}
                  onClick={() =>
                    toggleStatus.mutate({
                      id: ad.id,
                      status: ad.status === "active" ? "paused" : "active",
                    })
                  }
                >
                  {ad.status === "active" ? "Pause" : "Activate"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateAdDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function CreateAdDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [side, setSide] = useState<"sell" | "buy">("sell");
  const [asset, setAsset] = useState("OUSD");
  const [price, setPrice] = useState("1.00");
  const [total, setTotal] = useState("100");
  const [min, setMin] = useState("10");
  const [max, setMax] = useState("100");
  const [limitMin, setLimitMin] = useState("15");
  const [terms, setTerms] = useState("");
  const [methods, setMethods] = useState<string[]>([]);

  const methodsQ = useQuery({ queryKey: ["p2p-methods"], queryFn: fetchPaymentMethods });

  const create = useMutation({
    mutationFn: () =>
      createAd({
        side,
        asset,
        priceUsd: Number(price),
        totalAmount: Number(total),
        minOrder: Number(min),
        maxOrder: Number(max),
        paymentMethods: methods,
        payTimeLimitMinutes: Number(limitMin),
        terms: terms.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Advertisement published");
      void qc.invalidateQueries({ queryKey: ["p2p-my-ads"] });
      void qc.invalidateQueries({ queryKey: ["p2p-ads"] });
      onOpenChange(false);
      void navigate({ to: "/p2p/create" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalid = useMemo(
    () =>
      !(Number(price) > 0) ||
      !(Number(total) > 0) ||
      !(Number(min) > 0) ||
      !(Number(max) >= Number(min)) ||
      methods.length === 0,
    [price, total, min, max, methods],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create ad</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="inline-flex rounded-full bg-muted/60 p-1">
            {(["sell", "buy"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={cn(
                  "h-9 rounded-full px-5 text-sm font-bold capitalize",
                  side === s
                    ? s === "sell"
                      ? "bg-rose-500 text-white"
                      : "bg-emerald-500 text-white"
                    : "text-muted-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {P2P_ASSETS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAsset(a)}
                className={cn(
                  "h-8 rounded-lg border px-3 text-xs font-bold",
                  asset === a ? "border-foreground bg-secondary" : "border-border",
                )}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (USD)" value={price} onChange={setPrice} />
            <Field label={`Total (${asset})`} value={total} onChange={setTotal} />
            <Field label="Min order" value={min} onChange={setMin} />
            <Field label="Max order" value={max} onChange={setMax} />
            <Field label="Pay window (min)" value={limitMin} onChange={setLimitMin} />
          </div>

          <div className="flex flex-wrap gap-2">
            {(methodsQ.data ?? [])
              .filter((m) => m.is_active)
              .map((m) => {
                const on = methods.includes(m.code);
                return (
                  <button
                    key={m.code}
                    type="button"
                    onClick={() =>
                      setMethods((prev) =>
                        on ? prev.filter((c) => c !== m.code) : [...prev, m.code],
                      )
                    }
                    className={cn(
                      "h-8 rounded-lg border px-2.5 text-[11px] font-semibold",
                      on ? "border-foreground bg-secondary" : "border-border text-muted-foreground",
                    )}
                  >
                    {m.icon} {m.name}
                  </button>
                );
              })}
          </div>

          <Textarea
            value={terms}
            maxLength={1000}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Terms (optional)"
            className="min-h-20"
          />

          <Button
            className="h-11 w-full rounded-full font-bold"
            disabled={invalid || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish ad"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        className="h-10 tabular-nums"
      />
    </div>
  );
}
