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
    <div className="space-y-5 rounded-3xl bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold tracking-tight">Confirm fair launch</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ${symbol} ({name}) launches with a 100% fair bonding curve — no presale, whitelist, VC,
            or team allocation.
          </p>
        </div>
      </div>
      <ul className="space-y-2.5 rounded-2xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        <li>
          Launch fee: <span className="font-semibold text-foreground">{fee} OUSD</span> from your
          available balance
        </li>
        <li>Metadata is set at launch — review carefully</li>
        <li>Price discovery starts immediately on the OpenToken curve</li>
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="h-12 flex-1 rounded-full"
          onClick={onBack}
          disabled={busy}
        >
          Back
        </Button>
        <Button
          type="button"
          className="h-12 flex-1 rounded-full bg-primary font-bold text-primary-foreground"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Launching…" : `Pay ${fee} OUSD & Launch`}
        </Button>
      </div>
    </div>
  );
}
