import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, ShieldCheck, Wallet2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCompanyTurnkeyWallet,
  createMyTurnkeyWallet,
  getMyTurnkeyWallet,
  getTurnkeyStatus,
  listCompanyTurnkeyWallets,
  type TurnkeyWalletRow,
} from "@/lib/turnkey.functions";

export const Route = createFileRoute("/_authenticated/turnkey")({
  component: TurnkeyPage,
  head: () => ({
    meta: [
      { title: "Turnkey Wallets · OpenPay Pro" },
      {
        name: "description",
        content:
          "Create and manage Turnkey-secured embedded wallets and company treasury wallets for Solana and EVM inside OpenPay Pro.",
      },
      { property: "og:title", content: "Turnkey Wallets · OpenPay Pro" },
      {
        property: "og:description",
        content:
          "Turnkey-secured embedded wallets for every OpenPay Pro user, plus policy-controlled company treasury wallets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function AddressRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-xs">{value}</p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Copy ${label} address`}
        onClick={() => {
          void navigator.clipboard.writeText(value);
          toast.success(`${label} address copied`);
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

function WalletCard({ wallet }: { wallet: TurnkeyWalletRow }) {
  return (
    <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2">
        <Wallet2 className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">{wallet.label || "Turnkey wallet"}</p>
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">Wallet {wallet.wallet_id}</p>
      {wallet.sub_organization_id ? (
        <p className="font-mono text-[11px] text-muted-foreground">
          Sub-org {wallet.sub_organization_id}
        </p>
      ) : null}
      <AddressRow label="Solana" value={wallet.solana_address} />
      <AddressRow label="EVM" value={wallet.evm_address} />
    </div>
  );
}

function TurnkeyPage() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getTurnkeyStatus);
  const myWalletFn = useServerFn(getMyTurnkeyWallet);
  const createMineFn = useServerFn(createMyTurnkeyWallet);
  const companyListFn = useServerFn(listCompanyTurnkeyWallets);
  const createCompanyFn = useServerFn(createCompanyTurnkeyWallet);

  const [companyName, setCompanyName] = useState("Treasury");

  const status = useQuery({ queryKey: ["turnkey", "status"], queryFn: () => statusFn({}) });
  const mine = useQuery({ queryKey: ["turnkey", "mine"], queryFn: () => myWalletFn({}) });
  const company = useQuery({
    queryKey: ["turnkey", "company"],
    queryFn: () => companyListFn({}),
    retry: false,
  });

  const createMine = useMutation({
    mutationFn: () => createMineFn({}),
    onSuccess: () => {
      toast.success("Embedded wallet created");
      void qc.invalidateQueries({ queryKey: ["turnkey", "mine"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createCompany = useMutation({
    mutationFn: () => createCompanyFn({ data: { walletName: companyName } }),
    onSuccess: () => {
      toast.success("Company wallet created");
      void qc.invalidateQueries({ queryKey: ["turnkey", "company"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isAdmin = !company.isError && Array.isArray(company.data);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-24 pt-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Turnkey wallets</h1>
        <p className="text-sm text-muted-foreground">
          Secure key management for OpenPay Pro — an embedded wallet for your account and
          policy-controlled treasury wallets for the company. Solana + EVM from one seed.
        </p>
      </header>

      {status.data && !status.data.configured ? (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <KeyRound className="mt-0.5 h-4 w-4" />
          Turnkey credentials are missing on the backend. Add them and publish to enable wallets.
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">My embedded wallet</h2>
        </div>
        {mine.isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : mine.data ? (
          <WalletCard wallet={mine.data} />
        ) : (
          <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-sm text-muted-foreground">
              You don&apos;t have a Turnkey wallet yet. Creating one provisions a dedicated
              sub-organization with your own Solana and EVM addresses.
            </p>
            <Button
              onClick={() => createMine.mutate()}
              disabled={createMine.isPending || status.data?.configured === false}
            >
              {createMine.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create my wallet
            </Button>
          </div>
        )}
      </section>

      {isAdmin ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Wallet2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Company wallets</h2>
          </div>
          <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
            <Label htmlFor="tk-wallet-name">Wallet name</Label>
            <div className="flex gap-2">
              <Input
                id="tk-wallet-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Treasury"
              />
              <Button
                onClick={() => createCompany.mutate()}
                disabled={createCompany.isPending || status.data?.configured === false}
              >
                {createCompany.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create
              </Button>
            </div>
          </div>
          {(company.data ?? []).map((w) => (
            <WalletCard key={w.id} wallet={w} />
          ))}
        </section>
      ) : null}
    </main>
  );
}
