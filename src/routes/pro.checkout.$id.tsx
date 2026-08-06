import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, Clock, ExternalLink, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getProCheckout, payProCharge } from "@/lib/pro-connect.functions";

export const Route = createFileRoute("/pro/checkout/$id")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/authpi", search: { next } as never });
    }
  },
  head: () => ({
    meta: [
      { title: "Checkout — OpenPay Pro Pay" },
      {
        name: "description",
        content: "Pay a merchant with your OpenPay Pro OUSD balance.",
      },
    ],
  }),
  component: ProCheckoutPage,
  errorComponent: ({ error }) => (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold">Checkout unavailable</h1>
      <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function formatOusd(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

function ProCheckoutPage() {
  const { id } = Route.useParams();
  const load = useServerFn(getProCheckout);
  const pay = useServerFn(payProCharge);

  const [data, setData] = useState<Awaited<ReturnType<typeof getProCheckout>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void load({ data: { id } })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        if (res.charge.status === "paid") setPaid(true);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, load]);

  async function onPay() {
    setBusy(true);
    setError(null);
    try {
      const res = await pay({ data: { id } });
      setPaid(true);
      if (res.success_url) {
        window.setTimeout(() => {
          window.location.href = res.success_url!;
        }, 1200);
      } else {
        setBusy(false);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
        <h1 className="text-lg font-semibold">Charge not found</h1>
        <p className="text-sm text-muted-foreground">{error ?? "This checkout link is invalid."}</p>
      </main>
    );
  }

  const { charge, app, balance } = data;
  const status = paid ? "paid" : charge.status;
  const insufficient = balance < charge.amount;
  const canPay = status === "created" && !insufficient;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.72_0.12_295/0.2),transparent_55%),radial-gradient(ellipse_at_bottom_right,oklch(0.6_0.1_250/0.1),transparent_45%)]"
      />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-6">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            OpenPay Pro Pay
          </p>
          <h1 className="mt-2 text-xl font-extrabold tracking-tight">Confirm payment</h1>
        </div>

        <div className="space-y-5 rounded-3xl border border-border/60 bg-card/95 p-6 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            {app.logo_url ? (
              <img
                src={app.logo_url}
                alt=""
                className="h-12 w-12 rounded-2xl border border-border/50 object-cover"
              />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-lg font-bold text-primary">
                {app.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{app.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {app.handle ?? "Merchant"}
                {app.website_url ? ` · ${app.website_url.replace(/^https?:\/\//, "")}` : ""}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-muted/40 px-4 py-5 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Amount due
            </p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight text-foreground">
              {formatOusd(charge.amount)}
              <span className="ml-2 text-lg font-bold text-primary">{charge.currency}</span>
            </p>
            {charge.description ? (
              <p className="mt-2 text-sm text-muted-foreground">{charge.description}</p>
            ) : null}
            {charge.reference ? (
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                Ref {charge.reference}
              </p>
            ) : null}
          </div>

          {status === "paid" ? (
            <StatusBanner
              tone="success"
              icon={CheckCircle2}
              title="Paid"
              body="This charge was paid from your OUSD balance."
            />
          ) : status === "canceled" ? (
            <StatusBanner
              tone="muted"
              icon={XCircle}
              title="Canceled"
              body="The merchant canceled this charge."
            />
          ) : status === "expired" ? (
            <StatusBanner
              tone="warn"
              icon={Clock}
              title="Expired"
              body="This checkout link is no longer valid."
            />
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-background/50 px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Your balance</span>
              <span className="font-bold tabular-nums">{formatOusd(balance)} OUSD</span>
            </div>
          )}

          {status === "created" && insufficient ? (
            <StatusBanner
              tone="warn"
              icon={AlertCircle}
              title="Insufficient balance"
              body="Top up OUSD, then return to this page to pay."
            />
          ) : null}

          {error ? (
            <p role="alert" className="text-center text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {status === "created" ? (
            <div className="flex flex-col gap-2">
              <Button
                disabled={busy || !canPay}
                onClick={() => void onPay()}
                className="h-12 rounded-xl text-base font-bold"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Pay {formatOusd(charge.amount)} OUSD
              </Button>
              {insufficient ? (
                <Button asChild variant="outline" className="h-11 rounded-xl font-semibold">
                  <a href="/topup">Top up wallet</a>
                </Button>
              ) : null}
              {charge.cancel_url ? (
                <a
                  href={charge.cancel_url}
                  className="inline-flex h-10 items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          ) : status === "paid" && charge.success_url ? (
            <Button asChild className="h-12 rounded-xl font-bold">
              <a href={charge.success_url}>
                Continue
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          ) : null}
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          Secured by OpenPay Pro · funds stay on the Pro ledger
        </p>
      </div>
    </main>
  );
}

function StatusBanner({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: "success" | "warn" | "muted";
  icon: typeof CheckCircle2;
  title: string;
  body: string;
}) {
  const styles =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
        : "border-border/50 bg-muted/40 text-muted-foreground";
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl border px-3 py-3 ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-xs opacity-90">{body}</p>
      </div>
    </div>
  );
}
