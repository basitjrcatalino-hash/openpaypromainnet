import { useEffect, useState } from "react";
import { Loader2, AlertCircle, ShoppingBag } from "lucide-react";
import { openpayQr, type QrPayResponse } from "@/lib/openpay-qr";

type Props = {
  token: string;
  customerEmail?: string;
  customerName?: string;
  successUrl?: string;
  cancelUrl?: string;
  className?: string;
};

const PRIMARY = "#0070BA";

export function OpenPayCheckout({ token, customerEmail, customerName, successUrl, cancelUrl, className }: Props) {
  const [data, setData] = useState<QrPayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    openpayQr.getQr(token)
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  async function pay() {
    if (!customerEmail) { setError("Email required to checkout"); return; }
    setCheckoutBusy(true);
    setError(null);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { checkout_url } = await openpayQr.createCheckout({
        qr_pay_token: token,
        customer_email: customerEmail,
        customer_name: customerName,
        success_url: successUrl ?? `${origin}/topup?openpay=success`,
        cancel_url: cancelUrl ?? `${origin}/topup?openpay=cancel`,
      });
      window.location.href = checkout_url;
    } catch (e) {
      setError((e as Error).message);
      setCheckoutBusy(false);
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center rounded-2xl border border-border bg-card p-8 ${className ?? ""}`}>
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: PRIMARY }} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={`rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive ${className ?? ""}`}>
        <div className="flex items-center gap-2 font-medium"><AlertCircle className="h-4 w-4" /> Failed to load</div>
        <p className="mt-1 opacity-80">{error}</p>
      </div>
    );
  }

  if (!data) return null;
  const { qr_pay, items } = data;

  return (
    <div className={`rounded-2xl border border-border bg-card p-5 shadow-sm ${className ?? ""}`}>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ backgroundColor: PRIMARY }}>
          <ShoppingBag className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-base font-semibold">{qr_pay.title ?? "OpenPay product"}</div>
          {qr_pay.description && <p className="mt-0.5 text-xs text-muted-foreground">{qr_pay.description}</p>}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold tabular-nums" style={{ color: PRIMARY }}>
            {qr_pay.currency} {Number(qr_pay.amount).toFixed(2)}
          </div>
        </div>
      </div>

      {items?.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {items.map((it, i) => (
            <li key={it.id ?? i} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-medium">{it.name ?? `Item ${i + 1}`}</div>
                {it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}
                {it.quantity && it.quantity > 1 && <div className="text-xs text-muted-foreground">Qty {it.quantity}</div>}
              </div>
              <div className="font-medium tabular-nums">
                {qr_pay.currency} {Number(it.amount ?? it.unit_price ?? 0).toFixed(2)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/5 p-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}

      <button
        onClick={pay}
        disabled={checkoutBusy}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: PRIMARY }}
      >
        {checkoutBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Pay with OpenPay
      </button>
    </div>
  );
}

export default OpenPayCheckout;