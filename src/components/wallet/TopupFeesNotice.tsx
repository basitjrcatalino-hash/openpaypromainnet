import { ExternalLink, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/wallet-utils";

export type TopupProvider =
  | "openpay_balance"
  | "openpay_checkout"
  | "moonpay"
  | "pi"
  | "helio"
  | "usdc"
  | "wallet_ousd";

type Props = {
  method: TopupProvider;
  feeBps?: number;
  feeAmount?: number;
  netAmount?: number;
  className?: string;
};

const PROVIDER: Record<
  TopupProvider,
  { name: string; blurb: string; fees: string; thirdParty?: string }
> = {
  openpay_balance: {
    name: "OpenPay",
    blurb: "You’ll confirm this payment on OpenPay. Your linked OpenPay balance is debited, then OUSD is credited here.",
    fees: "OpenPay Pro may deduct a platform top-up fee from the credit. OpenPay’s own network rules still apply on their side.",
    thirdParty: "OpenPay",
  },
  openpay_checkout: {
    name: "OpenPay Checkout",
    blurb: "You’ll finish payment on OpenPay’s hosted checkout, then return here for OUSD credit.",
    fees: "OpenPay Pro may deduct a platform top-up fee. OpenPay checkout fees (if any) are set by OpenPay.",
    thirdParty: "OpenPay",
  },
  moonpay: {
    name: "MoonPay",
    blurb: "Card / Apple Pay / Google Pay runs in MoonPay’s widget — a third-party on-ramp. OpenPay Pro never sees your card details.",
    fees: "MoonPay adds its own processing fee and FX spread in the widget. After settlement, OpenPay Pro may also deduct a platform top-up fee from the OUSD credited.",
    thirdParty: "MoonPay",
  },
  pi: {
    name: "Pi Network",
    blurb: "You pay in π at the live Pi price. OpenPay Pro credits OUSD 1:1 with the USD value of that payment.",
    fees: "Pi Network wallet / network costs (if any) are outside OpenPay Pro. A platform top-up fee may be deducted from the OUSD credited.",
    thirdParty: "Pi Network",
  },
  helio: {
    name: "MoonPay Commerce",
    blurb: "SOL and other crypto deposits run through MoonPay Commerce (Helio) — a third-party deposit rail. Funds settle, then OUSD is credited.",
    fees: "Network gas and any MoonPay Commerce swap / processing fees apply on their side. OpenPay Pro may deduct a platform top-up fee from the OUSD credited.",
    thirdParty: "MoonPay Commerce",
  },
  usdc: {
    name: "MoonPay Commerce (USDC)",
    blurb: "USDC Pay uses MoonPay Commerce — a third-party deposit rail. Confirmed USDC settles 1:1 into OUSD here.",
    fees: "USDC transfer / network fees and any MoonPay Commerce fees apply on their side. OpenPay Pro may deduct a platform top-up fee from the OUSD credited.",
    thirdParty: "MoonPay Commerce",
  },
  wallet_ousd: {
    name: "Wallet OUSD",
    blurb: "Paid from your OpenPay Pro wallet balance — no third-party checkout.",
    fees: "No third-party processing fee. Platform trading rules for the asset still apply.",
  },
};

/**
 * Phantom-style disclosure for Buy / top-up confirm: third-party rails + fee summary.
 */
export function TopupFeesNotice({
  method,
  feeBps = 0,
  feeAmount = 0,
  netAmount,
  className,
}: Props) {
  const info = PROVIDER[method] ?? PROVIDER.moonpay;
  const hasPlatformFee = feeAmount > 0 && feeBps > 0;
  const feePct = (feeBps / 100).toFixed(2);

  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-border/60 bg-muted/40 px-3.5 py-3.5 text-left",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Info className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {info.thirdParty
              ? `Third-party · ${info.thirdParty}`
              : "Payment details"}
          </p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {info.blurb}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-background/70 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Fees
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          {info.fees}
        </p>
        {hasPlatformFee ? (
          <ul className="mt-2 space-y-1 text-[12px]">
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                OpenPay Pro fee ({feePct}%)
              </span>
              <span className="font-semibold tabular-nums text-destructive">
                −{formatUSD(feeAmount)}
              </span>
            </li>
            {typeof netAmount === "number" ? (
              <li className="flex items-center justify-between gap-3 border-t border-border/50 pt-1.5">
                <span className="font-medium text-foreground">You receive</span>
                <span className="font-bold tabular-nums text-foreground">
                  {formatUSD(netAmount)} OUSD
                </span>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="mt-2 text-[12px] font-medium text-foreground">
            No OpenPay Pro platform fee on this amount.
          </p>
        )}
      </div>

      {info.thirdParty ? (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
          <span>
            By continuing you leave OpenPay Pro’s control for payment processing
            with {info.thirdParty}. Their terms and fees apply until funds are
            confirmed back to your wallet.
          </span>
        </p>
      ) : null}
    </div>
  );
}
