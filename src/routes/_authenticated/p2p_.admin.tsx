import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Loader2, ShieldAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/wallet/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_STATUS_LABEL, fetchPaymentMethods, fmtAmount, statusTone } from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p_/admin")({
  head: () => ({
    meta: [
      { title: "P2P Admin — OpenPay Pro" },
      {
        name: "description",
        content: "Manage P2P payment methods, support roles, disputes and escrow releases.",
      },
      { property: "og:title", content: "P2P Admin — OpenPay Pro" },
      { property: "og:description", content: "Moderate P2P disputes and payment methods." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: P2PAdminPage,
});

type SupportRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  wallet_address: string | null;
  role: string;
  created_at: string;
};

function P2PAdminPage() {
  const qc = useQueryClient();
  const [supportUser, setSupportUser] = useState("");
  const [supportWallet, setSupportWallet] = useState("");

  const roleQ = useQuery({
    queryKey: ["p2p-admin-role"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { admin: false, mod: false };
      const [{ data: admin }, { data: mod }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: u.user.id, _role: "moderator" }),
      ]);
      return { admin: !!admin, mod: !!mod };
    },
  });

  const methodsQ = useQuery({ queryKey: ["p2p-methods"], queryFn: fetchPaymentMethods });
  const disputedQ = useQuery({
    queryKey: ["p2p-disputed-orders"],
    enabled: !!roleQ.data && (roleQ.data.admin || roleQ.data.mod),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("p2p_orders")
        .select("*")
        .in("status", ["disputed", "paid"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchInterval: 20_000,
  });

  const supportQ = useQuery({
    queryKey: ["p2p-support-staff"],
    enabled: !!roleQ.data && (roleQ.data.admin || roleQ.data.mod),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_list_p2p_support");
      if (error) throw new Error(error.message);
      return (data ?? []) as SupportRow[];
    },
  });

  const updateMethod = useMutation({
    mutationFn: async (v: {
      id: string;
      patch: { name?: string; sort_order?: number; is_active?: boolean; icon?: string | null };
    }) => {
      const { error } = await supabase.from("p2p_payment_methods").update(v.patch).eq("id", v.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["p2p-methods"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const setSupport = useMutation({
    mutationFn: async (v: { username: string; wallet: string; grant: boolean }) => {
      const { data, error } = await (supabase as any).rpc("admin_set_p2p_support", {
        _username: v.username.trim(),
        _wallet_address: v.wallet.trim(),
        _grant: v.grant,
      });
      if (error) throw new Error(error.message);
      return data as { username?: string; support?: boolean };
    },
    onSuccess: (data, vars) => {
      toast.success(
        vars.grant
          ? `Support role granted to ${data?.username ?? vars.username}`
          : `Support role removed from ${data?.username ?? vars.username}`,
      );
      setSupportUser("");
      setSupportWallet("");
      void qc.invalidateQueries({ queryKey: ["p2p-support-staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeSupport = useMutation({
    mutationFn: async (row: SupportRow) => {
      const uname = row.username || row.display_name;
      if (!row.wallet_address || !uname) {
        throw new Error("Missing username or wallet for this user");
      }
      const { error } = await (supabase as any).rpc("admin_set_p2p_support", {
        _username: uname,
        _wallet_address: row.wallet_address,
        _grant: false,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Support role removed");
      void qc.invalidateQueries({ queryKey: ["p2p-support-staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (roleQ.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!roleQ.data?.admin && !roleQ.data?.mod) {
    return (
      <div className="mx-auto grid max-w-md place-items-center gap-3 py-24 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Moderator or admin access is required for this page.
        </p>
        <Link to="/p2p" className="text-sm font-semibold text-primary">
          Back to marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full space-y-5 px-4 pb-24 md:px-6">
      <PageHeader title="P2P admin" backTo="/p2p" />

      {roleQ.data.admin ? (
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Set P2P support
            </h2>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Grant support access with the user&apos;s username and wallet address (must match the
            same account). Support can join trade chat, use dispute tools, and resolve escrow.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input
                value={supportUser}
                onChange={(e) => setSupportUser(e.target.value)}
                placeholder="@username"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Wallet address</Label>
              <Input
                value={supportWallet}
                onChange={(e) => setSupportWallet(e.target.value)}
                placeholder="Wallet address"
                className="h-11 font-mono text-xs"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              className="h-10 rounded-full font-bold"
              disabled={
                setSupport.isPending ||
                supportUser.trim().length < 2 ||
                supportWallet.trim().length < 8
              }
              onClick={() =>
                setSupport.mutate({
                  username: supportUser,
                  wallet: supportWallet,
                  grant: true,
                })
              }
            >
              {setSupport.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Grant support"
              )}
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-full"
              disabled={
                setSupport.isPending ||
                supportUser.trim().length < 2 ||
                supportWallet.trim().length < 8
              }
              onClick={() =>
                setSupport.mutate({
                  username: supportUser,
                  wallet: supportWallet,
                  grant: false,
                })
              }
            >
              Revoke support
            </Button>
          </div>

          <div className="mt-5 border-t border-border/50 pt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Current staff
            </h3>
            {supportQ.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : !(supportQ.data ?? []).length ? (
              <p className="text-sm text-muted-foreground">No support staff yet.</p>
            ) : (
              <div className="divide-y divide-border/40">
                {(supportQ.data ?? []).map((row) => (
                  <div
                    key={`${row.user_id}-${row.role}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {row.username || row.display_name || "User"}
                        <span
                          className={cn(
                            "ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            row.role === "admin"
                              ? "bg-primary/15 text-primary"
                              : "bg-violet-500/15 text-violet-400",
                          )}
                        >
                          {row.role === "admin" ? "Admin" : "Support"}
                        </span>
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {row.wallet_address ?? "—"}
                      </p>
                    </div>
                    {row.role === "moderator" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 shrink-0 rounded-full text-rose-500"
                        disabled={revokeSupport.isPending}
                        onClick={() => revokeSupport.mutate(row)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Disputes & pending settlements
        </h2>
        {disputedQ.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : !disputedQ.data?.length ? (
          <p className="text-sm text-muted-foreground">Nothing needs attention.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {disputedQ.data.map((o) => (
              <Link
                key={o.id}
                to="/p2p/order/$id"
                params={{ id: o.id }}
                className="flex items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold tabular-nums">
                    {o.ref} · {fmtAmount(o.amount)} {o.asset} · ${Number(o.total_fiat).toFixed(2)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{o.payment_method}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                    statusTone(o.status),
                  )}
                >
                  {ORDER_STATUS_LABEL[o.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {roleQ.data.admin ? (
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Payment methods
          </h2>
          <div className="space-y-3">
            {(methodsQ.data ?? []).map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3">
                <Input
                  defaultValue={m.name}
                  onBlur={(e) =>
                    e.target.value !== m.name &&
                    updateMethod.mutate({ id: m.id, patch: { name: e.target.value } })
                  }
                  className="h-10 max-w-56"
                />
                <Input
                  defaultValue={String(m.sort_order)}
                  onBlur={(e) =>
                    updateMethod.mutate({
                      id: m.id,
                      patch: { sort_order: Number(e.target.value) || 0 },
                    })
                  }
                  className="h-10 w-20 tabular-nums"
                />
                <span className="text-xs text-muted-foreground">{m.code}</span>
                <Switch
                  className="ml-auto"
                  checked={m.is_active}
                  onCheckedChange={(v) =>
                    updateMethod.mutate({ id: m.id, patch: { is_active: v } })
                  }
                />
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            className="mt-4 rounded-xl"
            onClick={() => void qc.invalidateQueries({ queryKey: ["p2p-methods"] })}
          >
            Refresh
          </Button>
        </div>
      ) : null}
    </div>
  );
}
