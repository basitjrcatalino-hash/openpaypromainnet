"use client";

import { MoonPayBuyWidget } from "@moonpay/moonpay-react";
import { requestMoonPayUrlSignature } from "@/lib/moonpay";

type Props = {
  visible: boolean;
  amount: string | number;
  externalCustomerId: string;
  externalTransactionId: string;
  defaultCurrencyCode?: string;
  onClose: () => void;
  onTransactionCompleted: (props: {
    id: string;
    baseCurrencyAmount: number;
    status: string;
  }) => void | Promise<void>;
};

/**
 * MoonPay Buy overlay for OUSD top-up / major crypto buys.
 * Signs the widget URL via onUrlSignatureRequested (never sends signature:"").
 */
export function MoonPayBuyOverlay({
  visible,
  amount,
  externalCustomerId,
  externalTransactionId,
  defaultCurrencyCode = "eth",
  onClose,
  onTransactionCompleted,
}: Props) {
  const baseCurrencyAmount = String(Math.max(Number(amount) || 20, 20));

  return (
    <MoonPayBuyWidget
      variant="overlay"
      visible={visible}
      baseCurrencyCode="usd"
      baseCurrencyAmount={baseCurrencyAmount}
      defaultCurrencyCode={defaultCurrencyCode}
      lockAmount="true"
      externalCustomerId={externalCustomerId}
      externalTransactionId={externalTransactionId}
      onUrlSignatureRequested={async (url) => {
        const signature = await requestMoonPayUrlSignature(url);
        if (!signature) {
          throw new Error(
            "MoonPay URL signing failed. Set MOONPAY_SECRET_KEY on the server.",
          );
        }
        return signature;
      }}
      onClose={async () => {
        onClose();
      }}
      onTransactionCompleted={async (props) => {
        await onTransactionCompleted({
          id: props.id,
          baseCurrencyAmount: props.baseCurrencyAmount,
          status: props.status,
        });
      }}
    />
  );
}
