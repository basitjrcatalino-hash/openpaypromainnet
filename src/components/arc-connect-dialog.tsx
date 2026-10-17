// Arc "Connect Wallet" dialog — styled after the Circle/Arc connect modal:
// rounded card, stacked wallet options, "I don't have a wallet" footer.
import { useEffect, useState } from "react";
import type { EIP1193Provider } from "viem";
import { Box, HelpCircle, Loader2, Wallet, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { browserWalletProvider, coinbaseWalletProvider, otherWalletProviders } from "@/lib/arc-providers";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (provider: EIP1193Provider) => void;
  busy?: boolean;
};

function CoinbaseIcon() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0052ff]">
      <span className="block h-4 w-4 rounded-full border-4 border-white" />
    </span>
  );
}

export function ArcConnectDialog({ open, onOpenChange, onSelect, busy }: Props) {
  const [others, setOthers] = useState<{ name: string; provider: EIP1193Provider }[]>([]);
  const [showOthers, setShowOthers] = useState(false);
  const [hasBrowser, setHasBrowser] = useState(false);
  const [hasCoinbase, setHasCoinbase] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowOthers(false);
    setHasBrowser(!!browserWalletProvider());
    setHasCoinbase(!!coinbaseWalletProvider());
    setOthers(otherWalletProviders());
  }, [open]);

  const pick = (provider: EIP1193Provider | null) => {
    if (!provider || busy) return;
    onSelect(provider);
  };

  const optionClass =
    "flex w-full items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-4 text-left text-base font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden" showCloseButton={false}>
        <div className="flex items-center justify-between px-5 pt-4">
          <a href="https://docs.arc.io/app-kit" target="_blank" rel="noopener noreferrer" aria-label="Arc wallet help" className="text-primary">
            <HelpCircle className="h-6 w-6" />
          </a>
          <DialogTitle className="text-lg font-semibold">Connect Wallet</DialogTitle>
          <button type="button" aria-label="Close" onClick={() => onOpenChange(false)} className="text-foreground">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="space-y-3 px-5 pt-5 pb-4">
          {!showOthers ? (
            <>
              <button type="button" className={optionClass} disabled={busy || !hasBrowser} onClick={() => pick(browserWalletProvider())}>
                <span>Browser Wallet</span>
                {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Box className="h-7 w-7" />}
              </button>
              <button type="button" className={optionClass} disabled={busy || !hasCoinbase} onClick={() => pick(coinbaseWalletProvider())}>
                <span>Coinbase Wallet</span>
                <CoinbaseIcon />
              </button>
              <button type="button" className={optionClass} disabled={busy || others.length === 0} onClick={() => setShowOthers(true)}>
                <span>Other Wallets</span>
                <span className="flex -space-x-1.5">
                  {others.slice(0, 4).map(w => (
                    <span key={w.name} className="grid h-6 w-6 place-items-center rounded-md bg-primary-foreground/20">
                      <Wallet className="h-3.5 w-3.5" />
                    </span>
                  ))}
                  {others.length === 0 && <Wallet className="h-6 w-6" />}
                </span>
              </button>
              {!hasBrowser && !hasCoinbase && others.length === 0 && (
                <p role="status" className="pt-1 text-center text-sm text-muted-foreground">
                  No wallet detected. Install an EVM wallet extension, then reopen this dialog.
                </p>
              )}
            </>
          ) : (
            <>
              {others.map(w => (
                <button key={w.name} type="button" className={optionClass} disabled={busy} onClick={() => pick(w.provider)}>
                  <span>{w.name}</span>
                  <Wallet className="h-6 w-6" />
                </button>
              ))}
              <button type="button" onClick={() => setShowOthers(false)} className="w-full pt-1 text-center text-sm font-medium text-primary">
                Back
              </button>
            </>
          )}
        </div>
        <a
          href="https://www.coinbase.com/wallet"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 border-t border-border py-4 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <Wallet className="h-4 w-4" /> I don’t have a wallet
        </a>
      </DialogContent>
    </Dialog>
  );
}
