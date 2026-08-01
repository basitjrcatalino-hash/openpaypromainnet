import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2, Plus, Wallet } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  P2P_ASSETS,
  fetchLockedEscrow,
  fetchMyPaymentAccounts,
  fetchPaymentMethods,
  fmtAmount,
  setPaymentAccountActive,
  upsertPaymentAccount,
  type P2PPaymentAccount,
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
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<P2PPaymentAccount | null>(null);

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
    for (const pm of methodsQ.data ?? []) m[pm.code] = `${pm.icon ?? ""} ${pm.name}`.trim();
    return m;
  }, [methodsQ.data]);

  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => setPaymentAccountActive(v.id, v.active),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["p2p-payment-accounts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const balances = P2P_ASSETS.map((asset) => {
    const key = `${asset.toLowerCase()}_balance` as keyof NonNullable<typeof walletQ.data>;
    const bal = Number(walletQ.data?.[key] ?? 0);
    const locked = Number(lockedQ.data?.[asset] ?? 0);
    return { asset, bal, locked, free: Math.max(0, bal - locked) };
  }).filter((b) => b.bal > 0 || b.locked > 0);

  const ready = (accountsQ.data ?? []).some((a) => a.is_active);

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
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
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
                    <p className="font-bold tabular-nums">
                      {fmtAmount(b.free)} free
                    </p>
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
            <Button
              size="sm"
              className="h-8 rounded-full"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Add
            </Button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Buyers send fiat here when they buy your crypto. Details are shown in the trade room.
          </p>

          {accountsQ.isLoading ? (
            <div className="grid place-items-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !(accountsQ.data ?? []).length ? (
            <P2pEmptyState
              title="No receive accounts"
              description="Add bank, GCash, Maya, or other payment details so P2P knows where you receive."
              action={
                <Button
                  className="mt-2 h-10 rounded-full px-5 font-bold"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  Add receive account
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border/40">
              {(accountsQ.data ?? []).map((acc) => (
                <div key={acc.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      {methodName[acc.method_code] ?? acc.method_code}
                      {!acc.is_active ? (
                        <span className="ml-2 text-[10px] font-semibold uppercase text-muted-foreground">
                          Off
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-foreground">{acc.account_name}</p>
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
  methods: { code: string; name: string; icon: string | null }[];
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
      toast.success(editing ? "Account updated" : "Receive account added");
      void qc.invalidateQueries({ queryKey: ["p2p-payment-accounts"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalid = name.trim().length < 2 || number.trim().length < 2 || !method;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit receive account" : "Add receive account"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {methods.map((m) => (
              <button
                key={m.code}
                type="button"
                onClick={() => setMethod(m.code)}
                className={cn(
                  "h-8 rounded-lg border px-2.5 text-[11px] font-semibold",
                  method === m.code
                    ? "border-foreground bg-secondary"
                    : "border-border text-muted-foreground",
                )}
              >
                {m.icon} {m.name}
              </button>
            ))}
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
          {method === "bank_transfer" ? (
            <div className="space-y-1.5">
              <Label>Bank name (optional)</Label>
              <Input
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                placeholder="e.g. BDO, BPI, UnionBank"
                className="h-11"
              />
            </div>
          ) : null}
          <Button
            className="h-11 w-full rounded-full font-bold"
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
