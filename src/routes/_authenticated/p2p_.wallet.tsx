import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { P2pEmptyState } from "@/components/p2p/P2pUi";
import { P2pPayIcon } from "@/components/p2p/P2pPayIcon";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  P2P_ASSETS,
  fetchLockedEscrow,
  fetchMyPaymentAccounts,
  fetchPaymentMethods,
  fmtAmount,
  setPaymentAccountActive,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p_/wallet")({
  head: () => ({
    meta: [
      { title: "Merchant Wallet — OpenPay Pro P2P" },
      {
        name: "description",
        content:
          "Fund crypto for P2P escrow and add receive accounts so buyers know where to send payment.",
      },
      { property: "og:title", content: "Merchant Wallet — OpenPay Pro P2P" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MerchantWalletPage,
});

function MerchantWalletPage() {
  const { code: fiat } = useCurrency();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const walletQ = useQuery({
    queryKey: ["active-wallet", userQ.data],
    enabled: !!userQ.data,
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userQ.data as string)
        .order("is_active", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const lockedQ = useQuery({
    queryKey: ["p2p-locked", userQ.data],
    enabled: !!userQ.data,
    queryFn: () => fetchLockedEscrow(userQ.data as string),
  });
  const accountsQ = useQuery({
    queryKey: ["p2p-payment-accounts", userQ.data],
    enabled: !!userQ.data,
    queryFn: () => fetchMyPaymentAccounts(userQ.data as string),
  });
  const methodsQ = useQuery({ queryKey: ["p2p-methods"], queryFn: fetchPaymentMethods });

  const methodName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const pm of methodsQ.data ?? []) m[pm.code] = pm.name;
    return m;
  }, [methodsQ.data]);

  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => setPaymentAccountActive(v.id, v.active),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["p2p-payment-accounts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const balances = P2P_ASSETS.map((asset) => {
    const w = walletQ.data as Record<string, number | string | boolean | null> | null | undefined;
    const bal = Number(w?.[`${asset.toLowerCase()}_balance`] ?? 0);
    const locked = Number(lockedQ.data?.[asset] ?? 0);
    return { asset, bal, locked, free: Math.max(0, bal - locked) };
  }).filter((b) => b.bal > 0 || b.locked > 0);

  const ready = (accountsQ.data ?? []).some((a) => a.is_active);

  const openForm = (id?: string) =>
    void navigate({
      to: "/p2p/payment-account",
      search: {
        return: "/p2p/wallet",
        ...(id ? { id } : {}),
      },
    });

  return (
    <div>
      <header
        className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border/40 bg-background/95 px-3 backdrop-blur-xl md:px-5"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <Link
          to="/p2p/profile"
          className="grid h-9 w-9 place-items-center rounded-full press"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-lg font-bold">Merchant wallet</h1>
        <button
          type="button"
          onClick={() => openForm()}
          className="grid h-9 w-9 place-items-center rounded-full press"
          aria-label="Add receive account"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      <div className="space-y-4 px-4 py-4 md:px-6">
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm",
            ready
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              : "border-amber-500/30 bg-amber-500/10 text-amber-500",
          )}
        >
          {ready
            ? "Ready for P2P — crypto funds and receive accounts are set."
            : "Required: add at least one receive account before publishing sell ads."}
        </div>

        <section className="rounded-2xl border border-border/50 bg-card/40 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-bold">Crypto funds (escrow)</h2>
            </div>
            <Button asChild size="sm" variant="secondary" className="h-8 rounded-full">
              <Link to="/deposit">Fund wallet</Link>
            </Button>
          </div>
          {walletQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : !balances.length ? (
            <p className="text-sm text-muted-foreground">
              No crypto balance yet. Deposit funds so you can publish sell ads and lock escrow.
            </p>
          ) : (
            <div className="space-y-2">
              {balances.map((b) => (
                <div key={b.asset} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold">{b.asset}</span>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{fmtAmount(b.free)} free</p>
                    <p className="text-[11px] text-muted-foreground">
                      {fmtAmount(b.bal)} wallet
                      {b.locked > 0 ? ` · ${fmtAmount(b.locked)} locked` : ""}
                      {" · ≈ "}
                      {formatCurrency(b.free, fiat as never, { compact: false })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border/50 bg-card/40 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold">Receive accounts</h2>
            <Button size="sm" className="h-8 rounded-full" onClick={() => openForm()}>
              Add
            </Button>
          </div>
          {accountsQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : !(accountsQ.data ?? []).length ? (
            <P2pEmptyState
              title="No receive accounts"
              description="Add GCash, bank, PIX, or other details so buyers know where to pay."
              action={
                <Button className="mt-2 h-9 rounded-full" onClick={() => openForm()}>
                  <Plus className="mr-1.5 h-4 w-4" /> Add account
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {(accountsQ.data ?? []).map((acc) => (
                <div key={acc.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-2 text-sm font-bold">
                      <P2pPayIcon
                        code={acc.method_code}
                        name={methodName[acc.method_code] ?? acc.method_code}
                        size="sm"
                      />
                      {methodName[acc.method_code] ?? acc.method_code}
                      {!acc.is_active ? (
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                          Off
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 truncate text-sm">{acc.account_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{acc.account_number}</p>
                    {acc.bank_name ? (
                      <p className="text-[11px] text-muted-foreground">{acc.bank_name}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full"
                      onClick={() => openForm(acc.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 rounded-full"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ id: acc.id, active: !acc.is_active })}
                    >
                      {acc.is_active ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <Button asChild variant="secondary" className="h-11 w-full rounded-full font-bold">
          <Link to="/p2p/create">Go to ads</Link>
        </Button>
      </div>
    </div>
  );
}
