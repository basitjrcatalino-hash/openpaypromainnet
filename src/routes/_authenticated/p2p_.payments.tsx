import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { P2pEmptyState } from "@/components/p2p/P2pUi";
import { P2pPayIcon } from "@/components/p2p/P2pPayIcon";
import { P2pHubLayout, P2pHubPill, P2pMenuCard } from "@/components/p2p/P2pSubpage";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchMyPaymentAccounts,
  fetchPaymentMethods,
  setPaymentAccountActive,
} from "@/lib/p2p";

export const Route = createFileRoute("/_authenticated/p2p_/payments")({
  head: () => ({
    meta: [
      { title: "Payment methods — OpenPay Pro P2P" },
      {
        name: "description",
        content: "Manage receive accounts for P2P sell ads.",
      },
      { property: "og:title", content: "Payment methods — OpenPay Pro P2P" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
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

  const openForm = (id?: string) =>
    void navigate({
      to: "/p2p/payment-account",
      search: {
        return: "/p2p/payments",
        ...(id ? { id } : {}),
      },
    });

  return (
    <P2pHubLayout
      title="Payment methods"
      dek="Buyers pay to these accounts when you sell. Add every method you list on your ads."
      crumb="Profile"
      eyebrow="Receive accounts"
      hero={{ from: "#a7f3d0", to: "#bfdbfe", glyph: "💳" }}
      actions={
        <>
          <button
            type="button"
            onClick={() => openForm()}
            className="inline-flex items-center rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)]"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add method
          </button>
          <P2pHubPill to="/p2p/create">Manage ads</P2pHubPill>
        </>
      }
    >
      {accountsQ.isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
        </div>
      ) : !(accountsQ.data ?? []).length ? (
        <P2pEmptyState
          title="No payment methods"
          description="Add GCash, bank, PIX, or other receive details before publishing sell ads."
          action={
            <Button
              className="mt-2 h-10 rounded-full bg-[var(--primary)] px-5 font-bold text-[var(--primary-foreground)]"
              onClick={() => openForm()}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add method
            </Button>
          }
        />
      ) : (
        <P2pMenuCard>
          {(accountsQ.data ?? []).map((acc) => (
            <div
              key={acc.id}
              className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 text-base font-bold tracking-tight">
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
                  className="h-8 rounded-full text-xs"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: acc.id, active: !acc.is_active })}
                >
                  {acc.is_active ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          ))}
        </P2pMenuCard>
      )}
    </P2pHubLayout>
  );
}
