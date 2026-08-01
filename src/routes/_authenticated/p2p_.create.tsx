import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { P2pEmptyState } from "@/components/p2p/P2pUi";
import { P2pPayChip } from "@/components/p2p/P2pPayIcon";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  closeAd,
  fetchMyAds,
  fetchMyMerchant,
  fetchPaymentMethods,
  fmtAmount,
  merchantCanList,
  setAdStatus,
} from "@/lib/p2p";
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
  const navigate = useNavigate();
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
  const methodsQ = useQuery({ queryKey: ["p2p-methods"], queryFn: fetchPaymentMethods });
  const merchantQ = useQuery({
    queryKey: ["p2p-my-merchant", userQ.data],
    enabled: !!userQ.data,
    queryFn: fetchMyMerchant,
  });
  const canList = merchantCanList(merchantQ.data);

  const goCreate = () => {
    if (!canList) {
      toast.error("Merchant approval required before listing ads");
      return;
    }
    void navigate({ to: "/p2p/create-new" });
  };

  const toggleStatus = useMutation({
    mutationFn: async (v: { id: string; status: "active" | "paused" }) => setAdStatus(v.id, v.status),
    onSuccess: () => {
      toast.success("Ad updated");
      void qc.invalidateQueries({ queryKey: ["p2p-my-ads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = useMutation({
    mutationFn: (id: string) => closeAd(id),
    onSuccess: () => {
      toast.success("Ad closed");
      void qc.invalidateQueries({ queryKey: ["p2p-my-ads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <header
        className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-border/40 bg-background/95 px-4 backdrop-blur-xl md:px-6"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <h1 className="text-lg font-bold">Ads</h1>
        <button
          type="button"
          onClick={goCreate}
          className="grid h-9 w-9 place-items-center rounded-full text-foreground press"
          aria-label="Create ad"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      {!canList ? (
        <div className="mx-4 mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 md:mx-6">
          <p className="text-sm font-bold text-amber-500">Merchant approval required</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Apply as a merchant (KYC + 100 OUSD in P2P) and wait for admin approval before listing
            ads.
          </p>
          <Button
            asChild
            className="mt-3 h-9 rounded-xl bg-[#11C66D] text-xs font-bold text-white hover:bg-[#0FB461]"
          >
            <Link to="/p2p/merchant">Apply now</Link>
          </Button>
        </div>
      ) : null}

      <div className="border-b border-border/40 px-4 py-2.5 text-xs text-muted-foreground md:px-6">
        Sell ads need a funded P2P account + receive accounts.{" "}
        <Link
          to="/transfer"
          search={{ from: "funding", to: "p2p" }}
          className="font-semibold text-primary"
        >
          Transfer to P2P ›
        </Link>
      </div>

      {myAdsQ.isLoading ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !myAdsQ.data?.length ? (
        <P2pEmptyState
          title="No ads found"
          description={
            canList
              ? "Create an ad to buy or sell crypto."
              : "Get merchant approval first, then publish ads."
          }
          action={
            canList ? (
              <Button
                className="mt-2 h-10 rounded-full bg-secondary px-6 font-bold text-foreground"
                onClick={goCreate}
              >
                Create ad
              </Button>
            ) : (
              <Button
                asChild
                className="mt-2 h-10 rounded-full bg-[#11C66D] px-6 font-bold text-white"
              >
                <Link to="/p2p/merchant">Apply as merchant</Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="divide-y divide-border/40">
          {myAdsQ.data.map((ad) => (
            <div key={ad.id} className="px-4 py-4 md:px-6">
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
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ad.payment_methods.length ? (
                  ad.payment_methods.map((code) => {
                    const m = (methodsQ.data ?? []).find((x) => x.code === code);
                    return <P2pPayChip key={code} code={code} label={m?.name ?? code} />;
                  })
                ) : (
                  <p className="text-xs text-muted-foreground">No methods</p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {ad.status !== "closed" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full"
                    disabled={toggleStatus.isPending || close.isPending}
                    onClick={() =>
                      toggleStatus.mutate({
                        id: ad.id,
                        status: ad.status === "active" ? "paused" : "active",
                      })
                    }
                  >
                    {ad.status === "active" ? "Pause" : "Activate"}
                  </Button>
                ) : null}
                {ad.status !== "closed" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full text-rose-500"
                    disabled={toggleStatus.isPending || close.isPending}
                    onClick={() => close.mutate(ad.id)}
                  >
                    Close
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
