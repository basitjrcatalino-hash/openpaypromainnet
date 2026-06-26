import { useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePiAuth } from "@/contexts/PiAuthContext";
import { claimTestnetPi, fetchWalletProgress, type WalletProgress } from "@/lib/piApi";

type Props = {
  onSuccess?: (data: { txid: string; progress: WalletProgress }) => void;
  className?: string;
};

export default function ClaimTestPiButton({ onSuccess, className }: Props) {
  const { session, signIn, inPiBrowser, sdkReady, loading: authLoading } = usePiAuth();
  const [claiming, setClaiming] = useState(false);
  const [lastTxid, setLastTxid] = useState<string | null>(null);
  const [progress, setProgress] = useState<WalletProgress | null>(null);

  const handleClaim = async () => {
    if (!inPiBrowser) { toast.error("Open this page in Pi Browser to claim."); return; }
    if (!sdkReady) { toast.error("Pi SDK not ready. Please wait or reload."); return; }
    setClaiming(true);
    try {
      let active = session;
      if (!active) active = await signIn();
      const result = await claimTestnetPi(active);
      setLastTxid(result.data.txid);
      setProgress(result.data.progress);
      toast.success(`Sent ${result.data.amount} Test Pi! TX: ${result.data.txid.slice(0, 12)}…`);
      onSuccess?.({ txid: result.data.txid, progress: result.data.progress });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Claim failed";
      if (msg.includes("already claimed")) toast.error("You have already claimed this reward.");
      else if (msg.includes("unique wallets")) toast.message("Testnet goal reached: 10 unique wallets completed.");
      else toast.error(msg);
      try { setProgress(await fetchWalletProgress()); } catch { /* ignore */ }
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className={className}>
      <Button
        onClick={() => void handleClaim()}
        disabled={claiming || authLoading || (inPiBrowser && !sdkReady)}
        className="h-11 w-full rounded-2xl bg-blue-600 text-white hover:bg-blue-700"
      >
        {claiming ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending Test Pi…</>
        ) : (
          <><Gift className="mr-2 h-4 w-4" /> Claim Test Pi</>
        )}
      </Button>
      {progress && <p className="mt-3 text-center text-sm text-muted-foreground">{progress.progress_label}</p>}
      {lastTxid && <p className="mt-1 text-center text-xs text-muted-foreground break-all">Success — txid: {lastTxid}</p>}
    </div>
  );
}