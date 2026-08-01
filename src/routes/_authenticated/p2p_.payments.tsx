import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { P2pEmptyState } from "@/components/p2p/P2pUi";
import { P2pPaymentMethodPicker } from "@/components/p2p/P2pPaymentMethodPicker";
import { P2pPayIcon } from "@/components/p2p/P2pPayIcon";
import { P2pSubpageHeader } from "@/components/p2p/P2pSubpage";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchMyPaymentAccounts,
  fetchPaymentMethods,
  setPaymentAccountActive,
  upsertPaymentAccount,
  type P2PPaymentAccount,
  type P2PPaymentMethod,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

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
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<P2PPaymentAccount | null>(null);

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

  return (
    <div>
      <P2pSubpageHeader
        title="Payment methods"
        right={
          <button
            type="button"
            className="text-xs font-bold text-[#11C66D]"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add
          </button>
        }
      />

      <p className="px-4 py-3 text-xs text-muted-foreground md:px-6">
        Buyers pay to these accounts when you sell. Add every method you list on your ads.{" "}
        <Link to="/p2p/create" className="font-semibold text-primary">
          Manage ads ›
        </Link>
      </p>

      {accountsQ.isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !(accountsQ.data ?? []).length ? (
        <P2pEmptyState
          title="No payment methods"
          description="Add GCash, bank, PIX, or other receive details before publishing sell ads."
          action={
            <Button
              className="mt-2 h-10 rounded-[8px] bg-[#11C66D] px-5 font-bold text-white hover:bg-[#0FB461]"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add method
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-border/40 border-y border-border/40">
          {(accountsQ.data ?? []).map((acc) => (
            <div key={acc.id} className="flex items-start justify-between gap-3 px-4 py-3.5 md:px-6">
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
                  onClick={() => {
                    setEditing(acc);
                    setFormOpen(true);
                  }}
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
        </div>
      )}

      <AccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        methods={(methodsQ.data ?? []).filter((m) => m.is_active && m.code !== "openpay")}
      />
    </div>
  );
}

function AccountFormDialog({
  open,
  onOpenChange,
  editing,
  methods,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: P2PPaymentAccount | null;
  methods: P2PPaymentMethod[];
}) {
  const qc = useQueryClient();
  const [method, setMethod] = useState(editing?.method_code ?? "bank_transfer");
  const [name, setName] = useState(editing?.account_name ?? "");
  const [number, setNumber] = useState(editing?.account_number ?? "");
  const [bank, setBank] = useState(editing?.bank_name ?? "");

  useEffect(() => {
    if (!open) return;
    setMethod(editing?.method_code ?? methods[0]?.code ?? "bank_transfer");
    setName(editing?.account_name ?? "");
    setNumber(editing?.account_number ?? "");
    setBank(editing?.bank_name ?? "");
  }, [open, editing, methods]);

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
      toast.success(editing ? "Updated" : "Payment method added");
      void qc.invalidateQueries({ queryKey: ["p2p-payment-accounts"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalid = name.trim().length < 2 || number.trim().length < 2 || !method;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit payment method" : "Add payment method"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Method</Label>
            <P2pPaymentMethodPicker
              methods={methods}
              mode="single"
              value={method}
              onSelect={setMethod}
              maxHeightClass="max-h-44"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Account name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label>Account number / handle</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label>Bank / notes (optional)</Label>
            <Input value={bank} onChange={(e) => setBank(e.target.value)} className="h-11" />
          </div>
          <Button
            className={cn(
              "h-11 w-full rounded-[8px] font-bold",
              invalid ? "bg-secondary text-muted-foreground" : "bg-[#11C66D] text-white hover:bg-[#0FB461]",
            )}
            disabled={invalid || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
