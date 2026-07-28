import { lazy, Suspense, type ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const PhantomContinueButtonInner = lazy(() =>
  import("@/components/phantom-auth-actions").then((m) => ({
    default: m.PhantomContinueButton,
  })),
);

const PhantomGoogleAppleLinkInner = lazy(() =>
  import("@/components/phantom-auth-actions").then((m) => ({
    default: m.PhantomGoogleAppleLink,
  })),
);

function PhantomFallback() {
  return (
    <Button type="button" disabled className="h-12 w-full rounded-xl">
      <Loader2 className="h-4 w-4 animate-spin" />
    </Button>
  );
}

/** Lazy wrappers kept outside the route file so TanStack code-splitting won't duplicate declarations. */
export function PhantomContinueButton(
  props: ComponentProps<typeof PhantomContinueButtonInner>,
) {
  return (
    <Suspense fallback={<PhantomFallback />}>
      <PhantomContinueButtonInner {...props} />
    </Suspense>
  );
}

export function PhantomGoogleAppleLink(
  props: ComponentProps<typeof PhantomGoogleAppleLinkInner>,
) {
  return (
    <Suspense fallback={null}>
      <PhantomGoogleAppleLinkInner {...props} />
    </Suspense>
  );
}
