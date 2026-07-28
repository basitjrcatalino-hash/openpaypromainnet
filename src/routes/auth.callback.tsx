import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import { usePhantomClientReady } from "@/components/phantom-provider";

/**
 * Phantom Connect OAuth redirect target.
 * redirectUrl is set dynamically to `${origin}/auth/callback` — allowlist that
 * exact URL (and Allowed Origin) in Phantom Portal for every deploy host.
 * Docs: https://docs.phantom.com/phantom-portal/configure-urls
 *
 * ConnectBox is lazy-loaded so @phantom/react-sdk (and CJS `buffer`) never
 * enter the SSR module graph via routeTree.
 */
const ConnectBox = lazy(() =>
  import("@phantom/react-sdk").then((m) => ({
    default: m.ConnectBox as ComponentType,
  })),
);

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({ meta: [{ title: "Connecting Phantom — OpenPay Pro" }] }),
  component: PhantomAuthCallbackPage,
});

function PhantomAuthCallbackPage() {
  const ready = usePhantomClientReady();

  if (!ready) {
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
        <ConnectBox />
      </Suspense>
    </div>
  );
}
