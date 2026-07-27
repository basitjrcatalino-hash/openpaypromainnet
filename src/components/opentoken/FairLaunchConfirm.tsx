import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_LAUNCH_FEE_OUSD } from "@/lib/opentoken/bonding-curve";

export function FairLaunchConfirm({
  name,
  symbol,
  fee = DEFAULT_LAUNCH_FEE_OUSD,
  busy,
  onBack,
  onConfirm,
}: {
  name: string;
  symbol: string;
  fee?: number;
  busy?: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-4 rounded-3xl border border-border/60 bg-card/70 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Confirm fair launch</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ${symbol} ({name}) launches with a 100% fair bonding curve — no presale, whitelist, VC, or
            team allocation.
          </p>
        </div>
      </div>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>
          • Launch fee: <span className="font-semibold text-foreground">{fee} OUSD</span> — paid from
          your available OUSD balance (not Pi)
        </li>
        <li>• Metadata is set at launch and should be reviewed carefully</li>
        <li>• Price discovery starts immediately on the OpenToken curve</li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="rounded-full" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button
          type="button"
          className="rounded-full bg-gradient-primary text-primary-foreground"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Launching…" : `Pay ${fee} OUSD & Launch`}
        </Button>
      </div>
    </div>
  );
}
