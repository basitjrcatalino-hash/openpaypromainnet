import { loadMoonPay } from "@moonpay/moonpay-js";
import {
  MOONPAY_API_KEY,
  buildMoonPayBuyUrl,
  moonPayEnvironment,
  requestMoonPayUrlSignature,
} from "@/lib/moonpay";

type ShowBuyOpts = {
  amount: string | number;
  baseCurrencyCode?: string;
  defaultCurrencyCode?: string;
  externalCustomerId?: string;
  externalTransactionId?: string;
  onClose?: () => void;
  onTransactionCompleted?: () => void;
};

/**
 * Fallback: open MoonPay buy overlay via @moonpay/moonpay-js.
 * Prefer MoonPayBuyOverlay (React widget) on the top-up page.
 */
export async function showMoonPayBuy(opts: ShowBuyOpts): Promise<void> {
  const amount = String(Math.max(Number(opts.amount) || 20, 20));
  const baseCurrencyCode = opts.baseCurrencyCode || "usd";
  const defaultCurrencyCode = opts.defaultCurrencyCode || "eth";

  const draft = buildMoonPayBuyUrl({
    amount,
    baseCurrencyCode,
    defaultCurrencyCode,
    externalCustomerId: opts.externalCustomerId,
    externalTransactionId: opts.externalTransactionId,
  });
  const signature = await requestMoonPayUrlSignature(draft);

  const params: Record<string, string> = {
    apiKey: MOONPAY_API_KEY,
    baseCurrencyCode,
    baseCurrencyAmount: amount,
    defaultCurrencyCode,
  };
  if (opts.externalCustomerId) params.externalCustomerId = opts.externalCustomerId;
  if (opts.externalTransactionId) params.externalTransactionId = opts.externalTransactionId;
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
    } as unknown as Parameters<NonNullable<typeof init>>[0]);

    if (!widget) throw new Error("MoonPay widget failed to initialize");
    widget.show();
  } catch (err) {
    const url = buildMoonPayBuyUrl({
      amount,
      baseCurrencyCode,
      defaultCurrencyCode,
      externalCustomerId: opts.externalCustomerId,
      externalTransactionId: opts.externalTransactionId,
      signature,
    });
    window.open(url, "_blank", "noopener,noreferrer");
    opts.onClose?.();
    if (err instanceof Error && !/SDK|widget|initialize/i.test(err.message)) {
      throw err;
    }
  }
}
