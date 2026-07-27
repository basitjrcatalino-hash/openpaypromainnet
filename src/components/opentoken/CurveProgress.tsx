import { formatNumber } from "@/lib/wallet-utils";
import {
  curveFromTokenRow,
  curveProgress,
  remainingTokens,
  spotPrice,
  quoteBuy,
} from "@/lib/opentoken/bonding-curve";
import { GraduationBadge } from "./GraduationBadge";

export function CurveProgress({ token }: { token: Record<string, any> }) {
  const curve = curveFromTokenRow(token);
  const progress = curveProgress(curve);
  const price = spotPrice(curve);
  const next = quoteBuy(curve, 1).nextPrice;
  const remaining = remainingTokens(curve);
  const graduated = token.status === "graduated";

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Bonding curve</div>
        {graduated ? <GraduationBadge /> : (
          <span className="text-xs text-muted-foreground">{(progress * 100).toFixed(1)}% to graduation</span>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-primary transition-all"
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Stat label="Price" value={`${formatNumber(price, 8)} π`} />
        <Stat label="Next (1π)" value={`${formatNumber(next, 8)} π`} />
        <Stat label="Reserve" value={`${formatNumber(curve.reservePi, 2)} / ${formatNumber(curve.graduationTargetPi, 0)} π`} />
        <Stat label="Remaining" value={formatNumber(remaining, 0)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );
}
