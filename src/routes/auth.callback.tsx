import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AppPhantomProvider,
  usePhantomClient,
  usePhantomClientReady,
} from "@/components/phantom-provider";
import {
  hasPhantomOAuthCallbackParams,
  readPhantomOAuthPending,
  snapshotPhantomCallbackUrl,
} from "@/lib/phantom";
import { Button } from "@/components/ui/button";

/**
 * Phantom Connect OAuth redirect target.
 * Docs: https://docs.phantom.com/phantom-portal/configure-urls
 *
 * Inner UI is lazy-loaded so @phantom/react-sdk never enters the SSR graph.
 */
const PhantomAuthCallbackInner = lazy(() =>
  import("@/components/phantom-auth-callback").then((m) => ({
    default: m.PhantomAuthCallbackInner,
  })),
);

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({ meta: [{ title: "Connecting Phantom — OpenPay Pro" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : undefined,
    state: typeof s.state === "string" ? s.state : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
    error_description:
      typeof s.error_description === "string" ? s.error_description : undefined,
  }),
  component: PhantomAuthCallbackRoute,
});

function PhantomAuthCallbackRoute() {
  return (
    <AppPhantomProvider>
      <PhantomAuthCallbackPage />
    </AppPhantomProvider>
  );
}

function PhantomAuthCallbackPage() {
  const ready = usePhantomClientReady();
  const { status, error, retry } = usePhantomClient();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"loading" | "connect" | "recover">("loading");

  useEffect(() => {
    snapshotPhantomCallbackUrl();

    if (search.error) {
      setMode("recover");
      return;
    }

    const pending = readPhantomOAuthPending();
    const hasParams =
      hasPhantomOAuthCallbackParams() || Boolean(search.code || search.state);

    if (!hasParams) {
      setMode("recover");
      return;
    }

    // OAuth was started on a different origin → sessionStorage state is gone here.
    if (pending?.origin && pending.origin !== window.location.origin) {
      setMode("recover");
      return;
    }

    setMode("connect");
  }, [search.code, search.state, search.error]);

  if (!ready && status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Preparing Phantom…</p>
        </div>
      </div>
    );
  }

  if (status === "error" || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">Unable to complete login</h1>
          <p className="text-sm text-muted-foreground">
            {error || "Phantom Connect failed to load."}
          </p>
          <div className="flex flex-col gap-2">
            <Button type="button" onClick={() => retry()}>
              Retry
            </Button>
            <Button type="button" variant="outline" onClick={() => {
              window.location.href = "/authpi";
            }}>
              Back to sign-in
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense
        fallback={<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
      >
        <PhantomAuthCallbackInner
          mode={mode}
          searchError={search.error}
          searchErrorDescription={search.error_description}
        />
      </Suspense>
    </div>
  );
}
