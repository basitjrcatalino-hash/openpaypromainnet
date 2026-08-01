import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { P2pEmptyState } from "@/components/p2p/P2pUi";
import { P2pPayIcon } from "@/components/p2p/P2pPayIcon";
import { P2pHubLayout, P2pHubPill, P2pMenuCard } from "@/components/p2p/P2pSubpage";
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
          "Transfer crypto into your P2P account for escrow and add receive accounts so buyers know where to send payment.",
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
        .select("id")
        .eq("user_id", userQ.data as string)
        .order("is_active", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const p2pBalQ = useQuery({
    queryKey: ["p2p-account-balances", walletQ.data?.id],
    enabled: !!walletQ.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_account_balances")
        .select("asset, balance")
        .eq("wallet_id", walletQ.data!.id)
        .eq("account", "p2p");
      if (error) {
        if (/wallet_account_balances|schema cache|does not exist/i.test(error.message)) {
          return {} as Record<string, number>;
        }
        throw error;
      }
      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        map[String(row.asset).toUpperCase()] = Number(row.balance ?? 0) || 0;
      }
      return map;
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

  // P2P bucket balance is already net of escrow locks; locked is informational.
  const balances = P2P_ASSETS.map((asset) => {
    const bal = Number(p2pBalQ.data?.[asset] ?? 0);
    const locked = Number(lockedQ.data?.[asset] ?? 0);
    return { asset, bal, locked, free: bal };
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

  const transferSearch = { from: "funding", to: "p2p" } as const;

  return (
    <P2pHubLayout
      title="Merchant wallet"
      dek="Transfer crypto into your P2P account for escrow and add receive accounts so buyers know where to send payment."
      crumb="Profile"
      eyebrow="Escrow · Receive"
      hero={{ from: "#bbf7d0", to: "#a5b4fc", glyph: "◈" }}
      actions={
        <>
          <button
            type="button"
            onClick={() => openForm()}
            className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add account
          </button>
          <Link
            to="/transfer"
            search={transferSearch}
            className="inline-flex items-center rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground"
          >
            Transfer to P2P
          </Link>
          <P2pHubPill to="/p2p/create">Go to ads</P2pHubPill>
        </>
      }
    >
      <div
        className={cn(
          "rounded-3xl border px-5 py-4 text-sm font-semibold",
          ready
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        )}
      >
        {ready
          ? "Ready for P2P — transfer funds into P2P and keep receive accounts active."
          : "Required: add at least one receive account before publishing sell ads."}
      </div>

      {p2pBalQ.isError ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-600 dark:text-rose-400">
          Couldn’t load P2P balances. Apply the wallet account balances migration, then refresh.
        </div>
      ) : null}

      <P2pMenuCard>
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              P2P account
            </h2>
          </div>
          <Button asChild size="sm" variant="secondary" className="h-8 rounded-full">
            <Link to="/transfer" search={transferSearch}>
              Transfer in
            </Link>
          </Button>
        </div>
        <div className="px-5 py-4">
          {walletQ.isLoading || p2pBalQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : !balances.length ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>No P2P balance yet. Transfer from Funding to publish sell ads and lock escrow.</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" className="h-8 rounded-full">
                  <Link to="/transfer" search={transferSearch}>
                    Transfer to P2P
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 rounded-full">
                  <Link to="/deposit">Deposit to Funding</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {balances.map((b) => (
                <div key={b.asset} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold">{b.asset}</span>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{fmtAmount(b.free)} available</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtAmount(b.bal)} in P2P
                      {b.locked > 0 ? ` · ${fmtAmount(b.locked)} in escrow` : ""}
                      {" · ≈ "}
                      {formatCurrency(b.free, fiat as never, { compact: false })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </P2pMenuCard>

      <P2pMenuCard>
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Receive accounts
          </h2>
          <Button size="sm" className="h-8 rounded-full" onClick={() => openForm()}>
            Add
          </Button>
        </div>
        <div className="px-5 py-4">
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
            <div className="space-y-4">
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
        </div>
      </P2pMenuCard>
    </P2pHubLayout>
  );
}
