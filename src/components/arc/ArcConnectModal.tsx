import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { ChevronLeft, Copy, Box, Loader2, Search, X, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { copyText } from "@/lib/clipboard";
import {
  ARC_CHAINS,
  POPULAR_WALLETS,
  WALLETCONNECT_OPTION,
  createWalletConnectProvider,
  discoverInjectedWallets,
  hasWalletConnectProjectId,
  type ArcNetworkId,
  type Eip1193,
  type WalletOption,
} from "@/lib/arc-wallet";
import { cn } from "@/lib/utils";

type View = "list" | "all" | "qr";

export function ArcConnectModal({
  open,
  onOpenChange,
  network,
  onNetworkChange,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  network: ArcNetworkId;
  onNetworkChange?: (n: ArcNetworkId) => void;
  onConnected: (provider: Eip1193, walletName: string) => Promise<void> | void;
}) {
  const [view, setView] = useState<View>("list");
  const [injected, setInjected] = useState<WalletOption[]>([]);
  const [search, setSearch] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [uri, setUri] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setView("list");
      setQr(null);
      setUri("");
      setBusy(null);
      return;
    }
    void discoverInjectedWallets().then(setInjected);
  }, [open]);

  async function pickInjected(w: WalletOption) {
    if (!w.provider) return;
    setBusy(w.id);
    try {
      await onConnected(w.provider, w.name);
      onOpenChange(false);
    } catch (e) {
      const m = (e as Error).message || "Connection failed";
      if (!/reject|denied|cancel/i.test(m)) toast.error(m);
    } finally {
      setBusy(null);
    }
  }

  async function startWalletConnect() {
    if (!hasWalletConnectProjectId()) {
      toast.error("WalletConnect is not configured.");
      return;
    }
    setView("qr");
    setQr(null);
    setBusy("walletconnect");
    try {
      const provider = await createWalletConnectProvider(network, async (u) => {
        setUri(u);
        setQr(await QRCode.toDataURL(u, { margin: 1, width: 640 }));
      });
      await onConnected(provider, "WalletConnect");
      onOpenChange(false);
    } catch (e) {
      const m = (e as Error).message || "Connection failed";
      if (!/reject|denied|cancel|closed/i.test(m)) toast.error(m);
      setView("list");
    } finally {
      setBusy(null);
    }
  }

  function pickPopular(name: string) {
    const inst = injected.find((w) => w.name.toLowerCase().includes(name.split(" ")[0].toLowerCase()));
    if (inst) void pickInjected(inst);
    else void startWalletConnect();
  }

  const filtered = useMemo(
    () => POPULAR_WALLETS.filter((w) => w.name.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-3xl border-border bg-card p-0 [&>button]:hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          {view === "list" ? (
            <span className="w-8" />
          ) : (
            <button type="button" aria-label="Back" onClick={() => setView("list")} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <DialogTitle className="text-base font-bold">
            {view === "list" ? "Connect Wallet" : view === "all" ? "All Wallets" : "WalletConnect"}
          </DialogTitle>
          <button type="button" aria-label="Close" onClick={() => onOpenChange(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {onNetworkChange && view === "list" && (
          <div className="mx-4 mb-3 hidden bg-muted p-1">
            {(["mainnet"] as const).map((n) => (
              <button
                key={n}
                type="button"
                disabled={!ARC_CHAINS[n].available}
                onClick={() => onNetworkChange(n)}
                className={cn(
                  "rounded-full py-1.5 text-sm font-semibold transition disabled:opacity-40",
                  network === n ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {ARC_CHAINS[n].name}
                {!ARC_CHAINS[n].available && " · soon"}
              </button>
            ))}
          </div>
        )}

        {view === "list" && (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto px-4 pb-4">
            {[...injected, WALLETCONNECT_OPTION].map((w) => (
              <button
                key={w.id}
                type="button"
                disabled={!!busy}
                onClick={() => (w.kind === "walletconnect" ? void startWalletConnect() : void pickInjected(w))}
                className="flex w-full items-center justify-between rounded-2xl bg-muted/70 px-4 py-3.5 text-left font-semibold transition hover:bg-muted disabled:opacity-60"
              >
                <span className="flex items-center gap-2">
                  {w.name}
                  {w.installed && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Installed</span>
                  )}
                </span>
                {busy === w.id ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : w.icon ? (
                  <img src={w.icon} alt="" className="h-8 w-8 rounded-lg" />
                ) : (
                  <Box className="h-7 w-7 text-muted-foreground" />
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setView("all")}
              className="flex w-full items-center justify-between rounded-2xl bg-muted/70 px-4 py-3.5 font-semibold hover:bg-muted"
            >
              All Wallets
              <span className="flex items-center gap-2">
                <span className="rounded-md bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">550+</span>
                <LayoutGrid className="h-6 w-6 text-primary" />
              </span>
            </button>
          </div>
        )}

        {view === "all" && (
          <div className="px-4 pb-4">
            <div className="mb-3 flex items-center gap-2 rounded-2xl bg-muted px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search wallet"
                className="h-10 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto">
              {filtered.map((w) => (
                <button
                  key={w.name}
                  type="button"
                  onClick={() => pickPopular(w.name)}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-muted/60 p-3 hover:bg-muted"
                >
                  <img src={w.icon} alt="" className="h-14 w-14 rounded-2xl" />
                  <span className="w-full truncate text-center text-xs font-semibold">{w.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === "qr" && (
          <div className="px-4 pb-5 text-center">
            <div className="mx-auto grid aspect-square w-full place-items-center rounded-3xl bg-background p-3">
              {qr ? (
                <img src={qr} alt="WalletConnect QR code" className="w-full rounded-2xl" />
              ) : (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              )}
            </div>
            <p className="mt-4 font-semibold">Scan this QR code with your phone</p>
            <button
              type="button"
              disabled={!uri}
              onClick={() => void copyText(uri).then(() => toast.success("Link copied"))}
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" /> Copy link
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
