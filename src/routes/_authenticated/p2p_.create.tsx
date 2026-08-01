import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/wallet/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { P2P_ASSETS, fetchMyAds, fetchPaymentMethods, fmtAmount } from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p_/create")({
  head: () => ({
    meta: [
      { title: "Create P2P Advertisement — OpenPay Pro" },
      {
        name: "description",
        content: "Post a buy or sell advertisement on the OpenPay Pro escrow-protected P2P market.",
      },
      { property: "og:title", content: "Create P2P Advertisement — OpenPay Pro" },
      { property: "og:description", content: "Set your price, limits and payment methods." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreateAdPage,
});

function CreateAdPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [side, setSide] = useState<"sell" | "buy">("sell");
  const [asset, setAsset] = useState<string>("OUSD");
  const [price, setPrice] = useState("1.00");
  const [total, setTotal] = useState("100");
  const [min, setMin] = useState("10");
  const [max, setMax] = useState("100");
  const [limitMin, setLimitMin] = useState("15");
  const [terms, setTerms] = useState("");
  const [methods, setMethods] = useState<string[]>([]);

  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const methodsQ = useQuery({ queryKey: ["p2p-methods"], queryFn: fetchPaymentMethods });
  const myAdsQ = useQuery({
    queryKey: ["p2p-my-ads", userQ.data],
    queryFn: () => fetchMyAds(userQ.data as string),
    enabled: !!userQ.data,
  });

  const create = useMutation({
    mutationFn: async () => {
      const uid = userQ.data;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase.from("p2p_ads").insert({
        user_id: uid,
        side,
        asset,
        price_usd: Number(price),
        total_amount: Number(total),
        available_amount: Number(total),
        min_order: Number(min),
        max_order: Number(max),
        payment_methods: methods,
        pay_time_limit_minutes: Number(limitMin),
        terms: terms.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Advertisement published");
      void qc.invalidateQueries({ queryKey: ["p2p-my-ads"] });
      void qc.invalidateQueries({ queryKey: ["p2p-ads"] });
      void navigate({ to: "/p2p" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async (v: { id: string; status: "active" | "paused" }) => {
      const { error } = await supabase.from("p2p_ads").update({ status: v.status }).eq("id", v.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["p2p-my-ads"] }),
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
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-24">
      <PageHeader title="Create advertisement" backTo="/p2p" />

      <div className="space-y-5 rounded-3xl border border-border/60 bg-card/70 p-5">
        <div className="inline-flex rounded-full bg-muted/60 p-1">
          {(["sell", "buy"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={cn(
                "h-9 rounded-full px-6 text-sm font-bold capitalize",
                side === s
                  ? s === "sell"
                    ? "bg-rose-500 text-white"
                    : "bg-emerald-500 text-white"
                  : "text-muted-foreground",
              )}
            >
              I want to {s}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label>Asset</Label>
          <div className="flex flex-wrap gap-1.5">
            {P2P_ASSETS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAsset(a)}
                className={cn(
                  "h-9 rounded-xl border px-4 text-xs font-bold",
                  asset === a ? "border-primary bg-primary/10 text-primary" : "border-border",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price per unit (USD)" value={price} onChange={setPrice} />
          <Field label={`Total amount (${asset})`} value={total} onChange={setTotal} />
          <Field label="Minimum order" value={min} onChange={setMin} />
          <Field label="Maximum order" value={max} onChange={setMax} />
          <Field label="Payment window (minutes)" value={limitMin} onChange={setLimitMin} />
        </div>

        <div className="space-y-1.5">
          <Label>Accepted payment methods</Label>
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
                      "h-9 rounded-xl border px-3 text-xs font-semibold",
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {m.icon} {m.name}
                  </button>
                );
              })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Terms and conditions</Label>
          <Textarea
            value={terms}
            maxLength={1000}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="e.g. Send from an account matching your verified name. No third-party payments."
            className="min-h-24"
          />
        </div>

        <Button
          className="h-12 w-full rounded-xl text-base font-bold"
          disabled={invalid || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish advertisement"}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Escrow locks the seller&apos;s balance only when a buyer opens an order.
        </p>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/50 p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          My advertisements
        </h2>
        {myAdsQ.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : !myAdsQ.data?.length ? (
          <p className="text-sm text-muted-foreground">No advertisements yet.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {myAdsQ.data.map((ad) => (
              <div key={ad.id} className="flex items-center gap-3 py-3">
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-bold uppercase",
                    ad.side === "sell"
                      ? "bg-rose-500/12 text-rose-500"
                      : "bg-emerald-500/12 text-emerald-500",
                  )}
                >
                  {ad.side}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold tabular-nums">
                    {fmtAmount(ad.available_amount)} / {fmtAmount(ad.total_amount)} {ad.asset} @ $
                    {fmtAmount(ad.price_usd)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {ad.payment_methods.join(", ") || "No methods"} · {ad.status}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
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
            ))}
          </div>
        )}
      </div>
    </div>
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
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        className="h-11 tabular-nums"
      />
    </div>
  );
}
