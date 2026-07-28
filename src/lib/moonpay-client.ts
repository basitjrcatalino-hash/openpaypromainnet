import { loadMoonPay } from "@moonpay/moonpay-js";
import {
  MOONPAY_API_KEY,
  buildMoonPayBuyUrl,
  moonPayEnvironment,
} from "@/lib/moonpay";

type ShowBuyOpts = {
  amount: string | number;
  baseCurrencyCode?: string;
  defaultCurrencyCode?: string;
  onClose?: () => void;
  onTransactionCompleted?: () => void;
};

/**
 * Open MoonPay buy overlay without sending an empty `signature` param.
 * (@moonpay/moonpay-react always sets signature:"" which MoonPay rejects.)
 */
export async function showMoonPayBuy(opts: ShowBuyOpts): Promise<void> {
  const amount = String(Math.max(Number(opts.amount) || 20, 20));
  const baseCurrencyCode = opts.baseCurrencyCode || "usd";
  const defaultCurrencyCode = opts.defaultCurrencyCode || "eth";

  let signature: string | undefined;
  try {
    const draft = buildMoonPayBuyUrl({
      amount,
      baseCurrencyCode,
      defaultCurrencyCode,
    });
    const res = await fetch(
      `/api/public/moonpay-sign?url=${encodeURIComponent(draft)}`,
    );
    if (res.ok) {
      const body = (await res.json()) as { signature?: string; configured?: boolean };
      if (body.signature) signature = body.signature;
    }
  } catch {
    /* signing optional when secret is not configured */
  }

  const params: Record<string, string> = {
    apiKey: MOONPAY_API_KEY,
    baseCurrencyCode,
    baseCurrencyAmount: amount,
    defaultCurrencyCode,
  };
  // Never send signature:"" — MoonPay treats that as an invalid signature.
  if (signature) params.signature = signature;

  try {
    const init = await loadMoonPay();
    if (!init) throw new Error("MoonPay SDK failed to load");

    const widget = init({
      flow: "buy",
      environment: moonPayEnvironment(),
      variant: "overlay",
      params,
      handlers: {
        onClose: async () => {
          opts.onClose?.();
        },
        onTransactionCompleted: async () => {
          opts.onTransactionCompleted?.();
        },
      },
    });

    if (!widget) throw new Error("MoonPay widget failed to initialize");
    widget.show();
  } catch (err) {
    // Fallback: open unsigned sandbox URL in a new tab (still no empty signature)
    const url = buildMoonPayBuyUrl({
      amount,
      baseCurrencyCode,
      defaultCurrencyCode,
      signature,
    });
    window.open(url, "_blank", "noopener,noreferrer");
    opts.onClose?.();
    if (err instanceof Error && !/SDK|widget|initialize/i.test(err.message)) {
      throw err;
    }
  }
}
