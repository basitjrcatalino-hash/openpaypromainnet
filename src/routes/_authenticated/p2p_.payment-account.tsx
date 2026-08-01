import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { P2pPaymentMethodPicker } from "@/components/p2p/P2pPaymentMethodPicker";
import { P2pSubpageHeader } from "@/components/p2p/P2pSubpage";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchMyPaymentAccounts,
  fetchPaymentMethods,
  upsertPaymentAccount,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

type AccountFormSearch = {
  id?: string;
  return?: "/p2p/payments" | "/p2p/wallet";
  method?: string;
};

export const Route = createFileRoute("/_authenticated/p2p_/payment-account")({
  validateSearch: (s: Record<string, unknown>): AccountFormSearch => ({
    id: typeof s.id === "string" && s.id.trim() ? s.id.trim() : undefined,
    return: s.return === "/p2p/wallet" ? "/p2p/wallet" : "/p2p/payments",
    method: typeof s.method === "string" && s.method.trim() ? s.method.trim() : undefined,
  }),
  head: ({ match }) => {
    const editing = !!match.search.id;
    return {
      meta: [
        {
          title: editing
            ? "Edit payment method — OpenPay Pro P2P"
            : "Add payment method — OpenPay Pro P2P",
        },
        {
          name: "description",
          content: "Add receive account details buyers use when paying you on P2P.",
        },
        { property: "og:title", content: "Payment method — OpenPay Pro P2P" },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: PaymentAccountPage,
});

function PaymentAccountPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const backTo = search.return ?? "/p2p/payments";
  const editingId = search.id;

  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const methodsQ = useQuery({ queryKey: ["p2p-methods"], queryFn: fetchPaymentMethods });
  const accountsQ = useQuery({
    queryKey: ["p2p-payment-accounts", userQ.data],
    enabled: !!userQ.data && !!editingId,
    queryFn: () => fetchMyPaymentAccounts(userQ.data as string),
  });

  const editing = useMemo(
    () => (editingId ? (accountsQ.data ?? []).find((a) => a.id === editingId) ?? null : null),
    [accountsQ.data, editingId],
  );

  const methods = useMemo(
    () => (methodsQ.data ?? []).filter((m) => m.is_active && m.code !== "openpay"),
    [methodsQ.data],
  );

  const [method, setMethod] = useState(search.method ?? "bank_transfer");
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [bank, setBank] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (editingId && accountsQ.isLoading) return;
    if (hydrated && editing?.id === editingId) return;

    if (editing) {
      setMethod(editing.method_code);
      setName(editing.account_name);
      setNumber(editing.account_number);
      setBank(editing.bank_name ?? "");
    } else {
      setMethod(search.method ?? methods[0]?.code ?? "bank_transfer");
      setName("");
      setNumber("");
      setBank("");
    }
    setHydrated(true);
  }, [editing, editingId, accountsQ.isLoading, methods, search.method, hydrated]);

  const save = useMutation({
    mutationFn: () =>
      upsertPaymentAccount({
        id: editing?.id,
        methodCode: method,
        accountName: name,
        accountNumber: number,
        bankName: bank,
      }),
    onSuccess: () => {
      toast.success(editing ? "Payment method updated" : "Payment method added");
      void qc.invalidateQueries({ queryKey: ["p2p-payment-accounts"] });
      void navigate({ to: backTo });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalid = name.trim().length < 2 || number.trim().length < 2 || !method;
  const loadingEdit = !!editingId && (accountsQ.isLoading || !hydrated);

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <P2pSubpageHeader
        title={editingId ? "Edit payment method" : "Add payment method"}
        backTo={backTo}
      />

      {loadingEdit ? (
        <div className="grid flex-1 place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-8 pt-3 md:px-6">
          <p className="mb-3 text-xs text-muted-foreground">
            Buyers pay to this account when they buy from your sell ads. Pick a method, then enter
            the exact details shown on your bank or wallet app.
          </p>

          <div className="min-h-0 flex-1 space-y-4">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <P2pPaymentMethodPicker
                methods={methods}
                mode="single"
                value={method}
                onSelect={setMethod}
                maxHeightClass="max-h-[min(52dvh,24rem)]"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Account name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name on account"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Account number / handle</Label>
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Bank account, GCash, email…"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bank / notes (optional)</Label>
              <Input
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                placeholder="e.g. BDO, BPI, branch"
                className="h-11"
              />
            </div>
          </div>

          <Button
            className={cn(
              "mt-4 h-12 w-full shrink-0 rounded-[8px] text-base font-bold",
              invalid
                ? "bg-secondary text-muted-foreground"
                : "bg-[#11C66D] text-white hover:bg-[#0FB461]",
            )}
            disabled={invalid || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
