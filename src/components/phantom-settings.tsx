"use client";

import { lazy, Suspense } from "react";

import { usePhantomClientReady } from "@/components/phantom-provider";

const PhantomSettingsRowsInner = lazy(() => import("@/components/phantom-settings-inner"));

/** Settings rows for Phantom Connect — only renders when the client provider is ready. */
export function PhantomSettingsRows() {
  const ready = usePhantomClientReady();
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <PhantomSettingsRowsInner />
    </Suspense>
  );
}
