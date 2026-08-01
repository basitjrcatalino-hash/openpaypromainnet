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
    <P2pHubLayout
      title="Merchant wallet"
      dek="Fund crypto for P2P escrow and add receive accounts so buyers know where to send payment."
      crumb="Profile"
      eyebrow="Escrow · Receive"
      hero={{ from: "#bbf7d0", to: "#a5b4fc", glyph: "◈" }}
      actions={
        <>
          <button
            type="button"
            onClick={() => openForm()}
            className="inline-flex items-center rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)]"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add account
          </button>
          <P2pHubPill to="/deposit">Fund wallet</P2pHubPill>
          <P2pHubPill to="/p2p/create">Go to ads</P2pHubPill>
        </>
      }
    >
      <div
        className={cn(
          "rounded-3xl border px-5 py-4 text-sm font-semibold",
          ready
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800",
        )}
      >
        {ready
          ? "Ready for P2P — crypto funds and receive accounts are set."
          : "Required: add at least one receive account before publishing sell ads."}
      </div>

      <P2pMenuCard>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[var(--muted-foreground)]" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
              Crypto funds (escrow)
            </h2>
          </div>
          <Button asChild size="sm" variant="secondary" className="h-8 rounded-full">
            <Link to="/deposit">Fund wallet</Link>
          </Button>
        </div>
        <div className="px-5 py-4">
          {walletQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
          ) : !balances.length ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No crypto balance yet. Deposit funds so you can publish sell ads and lock escrow.
            </p>
          ) : (
            <div className="space-y-3">
              {balances.map((b) => (
                <div key={b.asset} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold">{b.asset}</span>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{fmtAmount(b.free)} free</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
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
        </div>
      </P2pMenuCard>

      <P2pMenuCard>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
            Receive accounts
          </h2>
          <Button size="sm" className="h-8 rounded-full" onClick={() => openForm()}>
            Add
          </Button>
        </div>
        <div className="px-5 py-4">
          {accountsQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
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
                        <span className="text-[10px] font-semibold uppercase text-[var(--muted-foreground)]">
                          Off
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 truncate text-sm">{acc.account_name}</p>
                    <p className="font-mono text-xs text-[var(--muted-foreground)]">{acc.account_number}</p>
                    {acc.bank_name ? (
                      <p className="text-[11px] text-[var(--muted-foreground)]">{acc.bank_name}</p>
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
