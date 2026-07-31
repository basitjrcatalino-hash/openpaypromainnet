import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/wallet/PageHeader";
import { cn } from "@/lib/utils";
import { shortAddress, timeAgo } from "@/lib/wallet-utils";
import {
  adminDepositAction,
  adminDepositOverview,
  adminDeleteRow,
  adminPauseAll,
  adminSaveAddress,
  adminSaveChain,
  adminSaveToken,
} from "@/lib/deposit-gateway.functions";

export const Route = createFileRoute("/_authenticated/admin/deposits")({
  component: AdminDepositsPage,
});

type Row = Record<string, any>;
type Tab = "chains" | "tokens" | "addresses" | "deposits" | "logs";

const TABS: { id: Tab; label: string }[] = [
  { id: "chains", label: "Chains" },
  { id: "tokens", label: "Tokens" },
  { id: "addresses", label: "Addresses" },
  { id: "deposits", label: "Deposits" },
  { id: "logs", label: "Audit log" },
];

const emptyChain = {
  key: "",
  name: "",
  chain_id: null as number | null,
  family: "evm" as "evm" | "solana" | "bitcoin" | "other",
  rpc_url: "",
  explorer_url: "",
  required_confirmations: 12,
  bridge_status: "native",
  is_enabled: true,
  maintenance_mode: false,
};

const emptyToken = {
  chain_id: "",
  name: "",
  symbol: "",
  contract_address: "",
  decimals: 18,
  deposit_enabled: true,
  withdrawal_enabled: false,
  min_deposit: 0,
  max_deposit: null as number | null,
  deposit_fee_bps: 0,
  credit_symbol: "OUSD",
  usd_rate: null as number | null,
  status: "active" as "active" | "paused" | "delisted",
};

const emptyAddress = {
  chain_id: "",
  token_id: "" as string,
  address: "",
  label: "",
  memo_tag: "",
  is_active: true,
};

function AdminDepositsPage() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(adminDepositOverview);
  const saveChainFn = useServerFn(adminSaveChain);
  const saveTokenFn = useServerFn(adminSaveToken);
  const saveAddressFn = useServerFn(adminSaveAddress);
  const deleteFn = useServerFn(adminDeleteRow);
  const pauseFn = useServerFn(adminPauseAll);
  const actionFn = useServerFn(adminDepositAction);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-deposit-overview"],
    queryFn: () => overviewFn(),
    retry: false,
  });

  const [tab, setTab] = useState<Tab>("chains");
  const [chainForm, setChainForm] = useState({ ...emptyChain });
  const [tokenForm, setTokenForm] = useState({ ...emptyToken });
  const [addressForm, setAddressForm] = useState({ ...emptyAddress });

  const chains: Row[] = data?.chains ?? [];
  const tokens: Row[] = data?.tokens ?? [];
  const addresses: Row[] = data?.addresses ?? [];
  const deposits: Row[] = data?.deposits ?? [];
  const logs: Row[] = data?.logs ?? [];

  const chainName = useMemo(
    () => (id: string) => chains.find((c) => c.id === id)?.name ?? "—",
    [chains],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-deposit-overview"] });
  const onErr = (e: Error) => toast.error(e.message);

  const saveChain = useMutation({
    mutationFn: (payload: Row) => saveChainFn({ data: payload as never }),
    onSuccess: () => {
      toast.success("Chain saved");
      setChainForm({ ...emptyChain });
      void invalidate();
    },
    onError: onErr,
  });

  const saveToken = useMutation({
    mutationFn: (payload: Row) => saveTokenFn({ data: payload as never }),
    onSuccess: () => {
      toast.success("Token saved");
      setTokenForm({ ...emptyToken });
      void invalidate();
    },
    onError: onErr,
  });

  const saveAddress = useMutation({
    mutationFn: (payload: Row) => saveAddressFn({ data: payload as never }),
    onSuccess: () => {
      toast.success("Address saved");
      setAddressForm({ ...emptyAddress });
      void invalidate();
    },
    onError: onErr,
  });

  const remove = useMutation({
    mutationFn: (p: { table: "deposit_chains" | "deposit_tokens" | "deposit_addresses"; id: string }) =>
      deleteFn({ data: p }),
    onSuccess: () => {
      toast.success("Deleted");
      void invalidate();
    },
    onError: onErr,
  });

  const pause = useMutation({
    mutationFn: (paused: boolean) => pauseFn({ data: { paused } }),
    onSuccess: () => {
      toast.success("Gateway state updated");
      void invalidate();
    },
    onError: onErr,
  });

  const act = useMutation({
    mutationFn: (p: { id: string; action: "sync" | "credit" | "fail" }) => actionFn({ data: p }),
    onSuccess: () => {
      toast.success("Deposit updated");
      void invalidate();
    },
    onError: onErr,
  });

  if (isLoading) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }

  const allPaused = chains.length > 0 && chains.every((c) => c.maintenance_mode);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-24 pt-2">
      <PageHeader
        title="Deposit gateway"
        backTo="/dashboard"
        right={
          <Button
            type="button"
            size="sm"
            variant={allPaused ? "default" : "destructive"}
            className="rounded-full"
            onClick={() => pause.mutate(!allPaused)}
          >
            {allPaused ? "Resume all" : "Emergency pause"}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-semibold press",
              tab === t.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 text-muted-foreground hover:bg-muted/50",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------------- chains */}
      {tab === "chains" && (
        <div className="space-y-4">
          <Card className="space-y-3 rounded-3xl border-border/60 bg-card/70 p-4">
            <h2 className="text-sm font-bold">Add blockchain</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Key (slug)">
                <Input
                  value={chainForm.key}
                  onChange={(e) => setChainForm({ ...chainForm, key: e.target.value.toLowerCase() })}
                  placeholder="ethereum"
                />
              </Field>
              <Field label="Name">
                <Input
                  value={chainForm.name}
                  onChange={(e) => setChainForm({ ...chainForm, name: e.target.value })}
                  placeholder="Ethereum"
                />
              </Field>
              <Field label="Family">
                <select
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  value={chainForm.family}
                  onChange={(e) => setChainForm({ ...chainForm, family: e.target.value as never })}
                >
                  <option value="evm">EVM</option>
                  <option value="solana">Solana</option>
                  <option value="bitcoin">Bitcoin</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Chain ID (EVM)">
                <Input
                  type="number"
                  value={chainForm.chain_id ?? ""}
                  onChange={(e) =>
                    setChainForm({ ...chainForm, chain_id: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </Field>
              <Field label="RPC endpoint">
                <Input
                  value={chainForm.rpc_url}
                  onChange={(e) => setChainForm({ ...chainForm, rpc_url: e.target.value })}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Explorer URL">
                <Input
                  value={chainForm.explorer_url}
                  onChange={(e) => setChainForm({ ...chainForm, explorer_url: e.target.value })}
                  placeholder="https://etherscan.io"
                />
              </Field>
              <Field label="Required confirmations">
                <Input
                  type="number"
                  value={chainForm.required_confirmations}
                  onChange={(e) =>
                    setChainForm({ ...chainForm, required_confirmations: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Bridge status">
                <Input
                  value={chainForm.bridge_status}
                  onChange={(e) => setChainForm({ ...chainForm, bridge_status: e.target.value })}
                  placeholder="native / bridged"
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <Toggle
                label="Enabled"
                checked={chainForm.is_enabled}
                onChange={(v) => setChainForm({ ...chainForm, is_enabled: v })}
              />
              <Toggle
                label="Maintenance"
                checked={chainForm.maintenance_mode}
                onChange={(v) => setChainForm({ ...chainForm, maintenance_mode: v })}
              />
              <Button
                type="button"
                className="ml-auto rounded-full"
                disabled={saveChain.isPending}
                onClick={() =>
                  saveChain.mutate({
                    ...chainForm,
                    rpc_url: chainForm.rpc_url || null,
                    explorer_url: chainForm.explorer_url || null,
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Save chain
              </Button>
            </div>
          </Card>

          {chains.map((c) => (
            <Card key={c.id} className="rounded-2xl border-border/60 bg-card/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    {c.name} <span className="text-xs text-muted-foreground">({c.key})</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.family} · {c.required_confirmations} conf · {c.bridge_status} ·{" "}
                    {c.rpc_url ? "custom RPC" : "default RPC"}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Toggle
                    label="Enabled"
                    checked={c.is_enabled}
                    onChange={(v) => saveChain.mutate({ ...c, is_enabled: v })}
                  />
                  <Toggle
                    label="Maintenance"
                    checked={c.maintenance_mode}
                    onChange={(v) => saveChain.mutate({ ...c, maintenance_mode: v })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-destructive"
                    onClick={() => remove.mutate({ table: "deposit_chains", id: c.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ---------------------------------------------------------- tokens */}
      {tab === "tokens" && (
        <div className="space-y-4">
          <Card className="space-y-3 rounded-3xl border-border/60 bg-card/70 p-4">
            <h2 className="text-sm font-bold">Add token</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Blockchain">
                <select
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  value={tokenForm.chain_id}
                  onChange={(e) => setTokenForm({ ...tokenForm, chain_id: e.target.value })}
                >
                  <option value="">Select…</option>
                  {chains.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Token name">
                <Input
                  value={tokenForm.name}
                  onChange={(e) => setTokenForm({ ...tokenForm, name: e.target.value })}
                />
              </Field>
              <Field label="Symbol">
                <Input
                  value={tokenForm.symbol}
                  onChange={(e) => setTokenForm({ ...tokenForm, symbol: e.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Contract address (blank = native)">
                <Input
                  value={tokenForm.contract_address}
                  onChange={(e) => setTokenForm({ ...tokenForm, contract_address: e.target.value })}
                />
              </Field>
              <Field label="Decimals">
                <Input
                  type="number"
                  value={tokenForm.decimals}
                  onChange={(e) => setTokenForm({ ...tokenForm, decimals: Number(e.target.value) })}
                />
              </Field>
              <Field label="Credited as (wallet asset)">
                <Input
                  value={tokenForm.credit_symbol}
                  onChange={(e) =>
                    setTokenForm({ ...tokenForm, credit_symbol: e.target.value.toUpperCase() })
                  }
                  placeholder="OUSD"
                />
              </Field>
              <Field label="Minimum deposit">
                <Input
                  type="number"
                  value={tokenForm.min_deposit}
                  onChange={(e) => setTokenForm({ ...tokenForm, min_deposit: Number(e.target.value) })}
                />
              </Field>
              <Field label="Maximum deposit (blank = none)">
                <Input
                  type="number"
                  value={tokenForm.max_deposit ?? ""}
                  onChange={(e) =>
                    setTokenForm({
                      ...tokenForm,
                      max_deposit: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </Field>
              <Field label="Deposit fee (bps)">
                <Input
                  type="number"
                  value={tokenForm.deposit_fee_bps}
                  onChange={(e) =>
                    setTokenForm({ ...tokenForm, deposit_fee_bps: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="USD rate (optional)">
                <Input
                  type="number"
                  value={tokenForm.usd_rate ?? ""}
                  onChange={(e) =>
                    setTokenForm({
                      ...tokenForm,
                      usd_rate: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <Toggle
                label="Deposit enabled"
                checked={tokenForm.deposit_enabled}
                onChange={(v) => setTokenForm({ ...tokenForm, deposit_enabled: v })}
              />
              <Toggle
                label="Withdrawal enabled"
                checked={tokenForm.withdrawal_enabled}
                onChange={(v) => setTokenForm({ ...tokenForm, withdrawal_enabled: v })}
              />
              <Button
                type="button"
                className="ml-auto rounded-full"
                disabled={saveToken.isPending || !tokenForm.chain_id}
                onClick={() => saveToken.mutate({ ...tokenForm })}
              >
                <Plus className="mr-1 h-4 w-4" /> Save token
              </Button>
            </div>
          </Card>

          {tokens.map((t) => (
            <Card key={t.id} className="rounded-2xl border-border/60 bg-card/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">
                    {t.symbol} <span className="text-xs text-muted-foreground">{t.name}</span>
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {chainName(t.chain_id)} · {t.decimals} dp · min {t.min_deposit} · fee{" "}
                    {(t.deposit_fee_bps / 100).toFixed(2)}% · credits {t.credit_symbol}
                  </div>
                  {t.contract_address && (
                    <div className="truncate font-mono text-[10px] text-muted-foreground">
                      {t.contract_address}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <Toggle
                    label="Deposits"
                    checked={t.deposit_enabled}
                    onChange={(v) => saveToken.mutate({ ...t, deposit_enabled: v })}
                  />
                  <Toggle
                    label="Withdrawals"
                    checked={t.withdrawal_enabled}
                    onChange={(v) => saveToken.mutate({ ...t, withdrawal_enabled: v })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-destructive"
                    onClick={() => remove.mutate({ table: "deposit_tokens", id: t.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------- addresses */}
      {tab === "addresses" && (
        <div className="space-y-4">
          <Card className="space-y-3 rounded-3xl border-border/60 bg-card/70 p-4">
            <h2 className="text-sm font-bold">Add receiving address</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Blockchain">
                <select
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  value={addressForm.chain_id}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, chain_id: e.target.value, token_id: "" })
                  }
                >
                  <option value="">Select…</option>
                  {chains.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Token (blank = all tokens on chain)">
                <select
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  value={addressForm.token_id}
                  onChange={(e) => setAddressForm({ ...addressForm, token_id: e.target.value })}
                >
                  <option value="">All tokens</option>
                  {tokens
                    .filter((t) => t.chain_id === addressForm.chain_id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.symbol}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Address">
                <Input
                  value={addressForm.address}
                  onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
                  className="font-mono text-xs"
                />
              </Field>
              <Field label="Label">
                <Input
                  value={addressForm.label}
                  onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                  placeholder="Hot wallet"
                />
              </Field>
              <Field label="Memo / tag (optional)">
                <Input
                  value={addressForm.memo_tag}
                  onChange={(e) => setAddressForm({ ...addressForm, memo_tag: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex items-center gap-5">
              <Toggle
                label="Active"
                checked={addressForm.is_active}
                onChange={(v) => setAddressForm({ ...addressForm, is_active: v })}
              />
              <Button
                type="button"
                className="ml-auto rounded-full"
                disabled={saveAddress.isPending || !addressForm.chain_id || !addressForm.address}
                onClick={() =>
                  saveAddress.mutate({
                    ...addressForm,
                    token_id: addressForm.token_id || null,
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Save address
              </Button>
            </div>
          </Card>

          {addresses.map((a) => (
            <Card key={a.id} className="rounded-2xl border-border/60 bg-card/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{a.label || "Receiving address"}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {a.address}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {chainName(a.chain_id)} ·{" "}
                    {a.token_id ? tokens.find((t) => t.id === a.token_id)?.symbol : "all tokens"}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Toggle
                    label="Active"
                    checked={a.is_active}
                    onChange={(v) => saveAddress.mutate({ ...a, is_active: v })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-destructive"
                    onClick={() => remove.mutate({ table: "deposit_addresses", id: a.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* -------------------------------------------------------- deposits */}
      {tab === "deposits" && (
        <div className="space-y-2">
          {!deposits.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">No deposits yet.</p>
          )}
          {deposits.map((d) => (
            <Card key={d.id} className="rounded-2xl border-border/60 bg-card/60 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">
                  {d.amount} {d.token_symbol}{" "}
                  <span className="text-xs capitalize text-muted-foreground">{d.chain_key}</span>
                </div>
                <span className="text-[11px] capitalize text-muted-foreground">
                  {d.status} · {d.confirmations}/{d.required_confirmations} conf ·{" "}
                  {timeAgo(d.created_at)}
                </span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                {shortAddress(d.tx_hash, 10, 8)} → {shortAddress(d.to_address, 6, 6)}
              </div>
              {d.error && <p className="mt-1 text-[11px] text-destructive">{d.error}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => act.mutate({ id: d.id, action: "sync" })}
                >
                  Re-check
                </Button>
                {d.status !== "credited" && (
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    onClick={() => act.mutate({ id: d.id, action: "credit" })}
                  >
                    Credit manually
                  </Button>
                )}
                {d.status !== "credited" && d.status !== "failed" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="rounded-full"
                    onClick={() => act.mutate({ id: d.id, action: "fail" })}
                  >
                    Reject
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------ logs */}
      {tab === "logs" && (
        <Card className="rounded-3xl border-border/60 bg-card/70 p-4">
          {!logs.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">No events logged yet.</p>
          )}
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="rounded-xl border border-border/50 bg-background/50 p-2.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>{l.event}</span>
                  <span className="text-muted-foreground">{timeAgo(l.created_at)}</span>
                </div>
                <pre className="mt-1 overflow-x-auto text-[10px] text-muted-foreground">
                  {JSON.stringify(l.detail, null, 0)}
                </pre>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}
