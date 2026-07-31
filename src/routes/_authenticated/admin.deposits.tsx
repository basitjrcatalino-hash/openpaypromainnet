import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pause, Play, Plus, RefreshCw, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/wallet/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminListDeposits,
  adminPauseAllChains,
  adminResolveDeposit,
  adminSaveAddress,
  adminSaveChain,
  adminSaveToken,
  getDepositConfig,
} from "@/lib/deposit-gateway.functions";

export const Route = createFileRoute("/_authenticated/admin/deposits")({
  head: () => ({
    meta: [
      { title: "Deposit Gateway Admin — OpenPay Pro" },
      {
        name: "description",
        content:
          "Configure blockchains, tokens, receiving addresses and review incoming crypto deposits.",
      },
      { property: "og:title", content: "Deposit Gateway Admin — OpenPay Pro" },
      { property: "og:description", content: "Manage the OpenPay Pro multi-chain deposit gateway." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDepositsPage,
});

function AdminDepositsPage() {
  const qc = useQueryClient();
  const config = useQuery({ queryKey: ["deposit-config"], queryFn: () => getDepositConfig() });
  const depositsQ = useQuery({
    queryKey: ["admin-deposits"],
    queryFn: () => adminListDeposits(),
    enabled: Boolean(config.data?.isAdmin),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["deposit-config"] });
    void qc.invalidateQueries({ queryKey: ["admin-deposits"] });
  };

  const saveChain = useMutation({
    mutationFn: (data: any) => adminSaveChain({ data }),
    onSuccess: () => {
      toast.success("Network saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveToken = useMutation({
    mutationFn: (data: any) => adminSaveToken({ data }),
    onSuccess: () => {
      toast.success("Token saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveAddress = useMutation({
    mutationFn: (data: any) => adminSaveAddress({ data }),
    onSuccess: () => {
      toast.success("Address saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const resolve = useMutation({
    mutationFn: (data: any) => adminResolveDeposit({ data }),
    onSuccess: () => {
      toast.success("Deposit updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const pauseAll = useMutation({
    mutationFn: (paused: boolean) => adminPauseAllChains({ data: { paused } }),
    onSuccess: () => {
      toast.success("Gateway updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newToken, setNewToken] = useState({
    chain_id: "",
    name: "",
    symbol: "",
    contract_address: "",
    decimals: "18",
    min_deposit: "0",
    usd_rate: "1",
  });
  const [newAddr, setNewAddr] = useState({ chain_id: "", address: "", label: "" });

  if (config.isLoading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config.data?.isAdmin) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <PageHeader title="Deposit gateway" backTo="/dashboard" />
        <Card className="flex items-center gap-3 p-6 text-sm">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          Administrator access is required for this page.
        </Card>
      </div>
    );
  }

  const chains = (config.data.chains ?? []) as any[];
  const tokens = (config.data.tokens ?? []) as any[];
  const addresses = (config.data.addresses ?? []) as any[];
  const anyLive = chains.some((c) => c.is_enabled && !c.maintenance_mode);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 pb-24">
      <PageHeader title="Deposit gateway" backTo="/dashboard" />

      <Card className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold">Emergency control</p>
          <p className="text-xs text-muted-foreground">
            Pause every network instantly — pending deposits stay tracked.
          </p>
        </div>
        <Button
          variant={anyLive ? "destructive" : "default"}
          onClick={() => pauseAll.mutate(anyLive)}
          disabled={pauseAll.isPending}
        >
          {anyLive ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
          {anyLive ? "Pause all" : "Resume all"}
        </Button>
      </Card>

      <Tabs defaultValue="chains">
        <TabsList className="w-full">
          <TabsTrigger value="chains" className="flex-1">
            Chains
          </TabsTrigger>
          <TabsTrigger value="tokens" className="flex-1">
            Tokens
          </TabsTrigger>
          <TabsTrigger value="addresses" className="flex-1">
            Addresses
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex-1">
            Deposits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chains" className="space-y-3">
          {chains.map((c) => (
            <ChainRow key={c.id} chain={c} onSave={(d) => saveChain.mutate(d)} />
          ))}
        </TabsContent>

        <TabsContent value="tokens" className="space-y-3">
          <Card className="space-y-3 p-4">
            <p className="text-sm font-semibold">Add token</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                aria-label="Chain"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={newToken.chain_id}
                onChange={(e) => setNewToken({ ...newToken, chain_id: e.target.value })}
              >
                <option value="">Select network…</option>
                {chains.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Name (USD Coin)"
                value={newToken.name}
                onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
              />
              <Input
                placeholder="Symbol (USDC)"
                value={newToken.symbol}
                onChange={(e) => setNewToken({ ...newToken, symbol: e.target.value.toUpperCase() })}
              />
              <Input
                placeholder="Contract address (blank = native)"
                value={newToken.contract_address}
                onChange={(e) => setNewToken({ ...newToken, contract_address: e.target.value })}
              />
              <Input
                placeholder="Decimals"
                value={newToken.decimals}
                onChange={(e) => setNewToken({ ...newToken, decimals: e.target.value })}
              />
              <Input
                placeholder="USD rate"
                value={newToken.usd_rate}
                onChange={(e) => setNewToken({ ...newToken, usd_rate: e.target.value })}
              />
            </div>
            <Button
              onClick={() =>
                saveToken.mutate({
                  chain_id: newToken.chain_id,
                  name: newToken.name,
                  symbol: newToken.symbol,
                  contract_address: newToken.contract_address || null,
                  decimals: Number(newToken.decimals) || 18,
                  deposit_enabled: true,
                  withdrawal_enabled: false,
                  min_deposit: Number(newToken.min_deposit) || 0,
                  max_deposit: null,
                  deposit_fee_bps: 0,
                  credit_symbol: "OUSD",
                  usd_rate: Number(newToken.usd_rate) || 1,
                  status: "active",
                  sort_order: 100,
                })
              }
              disabled={!newToken.chain_id || !newToken.symbol || saveToken.isPending}
            >
              <Plus className="mr-2 h-4 w-4" /> Add token
            </Button>
          </Card>

          {tokens.map((t) => (
            <TokenRow key={t.id} token={t} chains={chains} onSave={(d) => saveToken.mutate(d)} />
          ))}
        </TabsContent>

        <TabsContent value="addresses" className="space-y-3">
          <Card className="space-y-3 p-4">
            <p className="text-sm font-semibold">Add receiving address</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                aria-label="Chain for address"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={newAddr.chain_id}
                onChange={(e) => setNewAddr({ ...newAddr, chain_id: e.target.value })}
              >
                <option value="">Select network…</option>
                {chains.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Label (Treasury hot wallet)"
                value={newAddr.label}
                onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
              />
              <Input
                className="sm:col-span-2"
                placeholder="Receiving address"
                value={newAddr.address}
                onChange={(e) => setNewAddr({ ...newAddr, address: e.target.value })}
              />
            </div>
            <Button
              onClick={() =>
                saveAddress.mutate({
                  chain_id: newAddr.chain_id,
                  token_id: null,
                  address: newAddr.address.trim(),
                  label: newAddr.label || null,
                  is_active: true,
                })
              }
              disabled={!newAddr.chain_id || newAddr.address.trim().length < 10 || saveAddress.isPending}
            >
              <Plus className="mr-2 h-4 w-4" /> Add address
            </Button>
          </Card>

          {addresses.map((a) => (
            <Card key={a.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{a.label ?? "Receiving address"}</p>
                <p className="truncate text-xs text-muted-foreground">{a.address}</p>
                <p className="text-xs text-muted-foreground">
                  {chains.find((c) => c.id === a.chain_id)?.name ?? "Unknown network"}
                </p>
              </div>
              <Switch
                checked={a.is_active}
                aria-label="Address active"
                onCheckedChange={(v) =>
                  saveAddress.mutate({
                    id: a.id,
                    chain_id: a.chain_id,
                    token_id: a.token_id,
                    address: a.address,
                    label: a.label,
                    is_active: v,
                  })
                }
              />
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="queue" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => void depositsQ.refetch()} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {((depositsQ.data as any[]) ?? []).length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">No deposits recorded yet.</Card>
          ) : (
            ((depositsQ.data as any[]) ?? []).map((d) => (
              <Card key={d.id} className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {Number(d.amount)} {d.token_symbol} · {d.chain_key}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{d.tx_hash}</p>
                  </div>
                  <Badge variant="outline">{d.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" onClick={() => resolve.mutate({ id: d.id, action: "recheck" })}>
                    Re-check
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => resolve.mutate({ id: d.id, action: "credit" })}>
                    Credit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => resolve.mutate({ id: d.id, action: "reject" })}>
                    Reject
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChainRow({ chain, onSave }: { chain: any; onSave: (data: any) => void }) {
  const [state, setState] = useState({
    rpc_url: chain.rpc_url ?? "",
    explorer_url: chain.explorer_url ?? "",
    required_confirmations: String(chain.required_confirmations),
    is_enabled: chain.is_enabled,
    maintenance_mode: chain.maintenance_mode,
  });

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{chain.name}</p>
          <p className="text-xs text-muted-foreground">
            {chain.family.toUpperCase()} · {chain.key}
          </p>
        </div>
        <Badge variant="outline">{chain.bridge_status}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">RPC URL</Label>
          <Input value={state.rpc_url} onChange={(e) => setState({ ...state, rpc_url: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Explorer URL</Label>
          <Input
            value={state.explorer_url}
            onChange={(e) => setState({ ...state, explorer_url: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Required confirmations</Label>
          <Input
            value={state.required_confirmations}
            onChange={(e) => setState({ ...state, required_confirmations: e.target.value })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={state.is_enabled}
            onCheckedChange={(v) => setState({ ...state, is_enabled: v })}
            aria-label="Chain enabled"
          />
          Enabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={state.maintenance_mode}
            onCheckedChange={(v) => setState({ ...state, maintenance_mode: v })}
            aria-label="Maintenance mode"
          />
          Maintenance
        </label>
        <Button
          size="sm"
          className="ml-auto"
          onClick={() =>
            onSave({
              id: chain.id,
              key: chain.key,
              name: chain.name,
              family: chain.family,
              chain_id: chain.chain_id,
              rpc_url: state.rpc_url || null,
              explorer_url: state.explorer_url || null,
              required_confirmations: Number(state.required_confirmations) || 1,
              bridge_status: chain.bridge_status,
              is_enabled: state.is_enabled,
              maintenance_mode: state.maintenance_mode,
              sort_order: chain.sort_order ?? 100,
            })
          }
        >
          <Save className="mr-2 h-4 w-4" /> Save
        </Button>
      </div>
    </Card>
  );
}

function TokenRow({
  token,
  chains,
  onSave,
}: {
  token: any;
  chains: any[];
  onSave: (data: any) => void;
}) {
  const [state, setState] = useState({
    min_deposit: String(token.min_deposit ?? 0),
    max_deposit: token.max_deposit == null ? "" : String(token.max_deposit),
    deposit_fee_bps: String(token.deposit_fee_bps ?? 0),
    usd_rate: token.usd_rate == null ? "" : String(token.usd_rate),
    deposit_enabled: token.deposit_enabled,
    withdrawal_enabled: token.withdrawal_enabled,
  });

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">
            {token.symbol} · {token.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {chains.find((c) => c.id === token.chain_id)?.name} ·{" "}
            {token.contract_address ?? "native asset"}
          </p>
        </div>
        <Badge variant="outline">{token.status}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <div>
          <Label className="text-xs">Min</Label>
          <Input value={state.min_deposit} onChange={(e) => setState({ ...state, min_deposit: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Max</Label>
          <Input value={state.max_deposit} onChange={(e) => setState({ ...state, max_deposit: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Fee (bps)</Label>
          <Input
            value={state.deposit_fee_bps}
            onChange={(e) => setState({ ...state, deposit_fee_bps: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">USD rate</Label>
          <Input value={state.usd_rate} onChange={(e) => setState({ ...state, usd_rate: e.target.value })} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={state.deposit_enabled}
            onCheckedChange={(v) => setState({ ...state, deposit_enabled: v })}
            aria-label="Deposits enabled"
          />
          Deposits
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={state.withdrawal_enabled}
            onCheckedChange={(v) => setState({ ...state, withdrawal_enabled: v })}
            aria-label="Withdrawals enabled"
          />
          Withdrawals
        </label>
        <Button
          size="sm"
          className="ml-auto"
          onClick={() =>
            onSave({
              id: token.id,
              chain_id: token.chain_id,
              name: token.name,
              symbol: token.symbol,
              contract_address: token.contract_address,
              decimals: token.decimals,
              deposit_enabled: state.deposit_enabled,
              withdrawal_enabled: state.withdrawal_enabled,
              min_deposit: Number(state.min_deposit) || 0,
              max_deposit: state.max_deposit === "" ? null : Number(state.max_deposit),
              deposit_fee_bps: Number(state.deposit_fee_bps) || 0,
              credit_symbol: token.credit_symbol ?? "OUSD",
              usd_rate: state.usd_rate === "" ? null : Number(state.usd_rate),
              status: token.status,
              sort_order: token.sort_order ?? 100,
            })
          }
        >
          <Save className="mr-2 h-4 w-4" /> Save
        </Button>
      </div>
    </Card>
  );
}
