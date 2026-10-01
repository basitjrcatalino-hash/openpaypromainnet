import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Link2, Unlink, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArcConnectModal } from "@/components/arc/ArcConnectModal";
import {
  ARC_CHAINS,
  getArcBalance,
  loadLinkedWallet,
  requestAccount,
  saveLinkedWallet,
  switchToArc,
  type ArcNetworkId,
  type LinkedArcWallet,
} from "@/lib/arc-wallet";
import { shortAddress } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/arc")({
  head: () => ({
    meta: [
      { title: "Arc Wallet — OpenPay Pro" },
      { name: "description", content: "Connect MetaMask, WalletConnect and 550+ wallets to the Arc network." },
    ],
  }),
  component: ArcPage,
});

function ArcPage() {
  const [network, setNetwork] = useState<ArcNetworkId>("testnet");
  const [linked, setLinked] = useState<LinkedArcWallet | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const l = loadLinkedWallet();
    if (l) {
      setLinked(l);
      setNetwork(l.network);
    }
  }, []);

  const { data: balance, isFetching } = useQuery({
    queryKey: ["arc-balance", linked?.address, network],
    enabled: !!linked,
    queryFn: () => getArcBalance(linked!.address, network),
  });

  const chain = ARC_CHAINS[network];

  return (
    <div className="mx-auto w-full max-w-lg animate-page-in pb-10">
      <header className="mb-6 flex items-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Wallet className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Arc Wallet</h1>
          <p className="text-sm text-muted-foreground">Connect any wallet to the Arc network</p>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
        {(["testnet", "mainnet"] as const).map((n) => (
          <button
            key={n}
            type="button"
            disabled={!ARC_CHAINS[n].available}
            onClick={() => {
              setNetwork(n);
              if (linked) {
                const next = { ...linked, network: n };
                setLinked(next);
                saveLinkedWallet(next);
              }
            }}
            className={cn(
              "rounded-full py-2 text-sm font-semibold disabled:opacity-40",
              network === n ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {ARC_CHAINS[n].name}
            {!ARC_CHAINS[n].available && " · soon"}
          </button>
        ))}
      </div>

      {linked ? (
        <section className="rounded-3xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">{linked.wallet} · {chain.name}</p>
          <p className="mt-2 text-4xl font-extrabold">
            {isFetching ? "…" : Number(balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
            <span className="text-lg text-muted-foreground">USDC</span>
          </p>
          <p className="mt-2 font-mono text-sm">{shortAddress(linked.address, 6, 6)}</p>
          <div className="mt-5 flex justify-center gap-2">
            {chain.explorer && (
              <Button asChild variant="secondary" className="rounded-full">
                <a href={`${chain.explorer}/address/${linked.address}`} target="_blank" rel="noreferrer">
                  Explorer <ExternalLink className="ml-1 h-4 w-4" />
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                saveLinkedWallet(null);
                setLinked(null);
              }}
            >
              <Unlink className="mr-1 h-4 w-4" /> Disconnect
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No wallet linked yet.</p>
          <Button className="mt-4 rounded-full" onClick={() => setOpen(true)}>
            <Link2 className="mr-1 h-4 w-4" /> Connect wallet
          </Button>
        </section>
      )}

      <ArcConnectModal
        open={open}
        onOpenChange={setOpen}
        network={network}
        onNetworkChange={setNetwork}
        onConnected={async (provider, walletName) => {
          const address = await requestAccount(provider);
          try {
            await switchToArc(provider, network);
          } catch (e) {
            toast.message(`Connected — switch to ${chain.name} in your wallet if needed.`);
            console.warn(e);
          }
          const next = { address, wallet: walletName, network };
          saveLinkedWallet(next);
          setLinked(next);
          toast.success("Wallet connected");
        }}
      />
    </div>
  );
}
