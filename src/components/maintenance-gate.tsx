import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wrench } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { findBlockingFlag, useFeatureFlags } from "@/lib/feature-flags";
import { checkIsAdmin } from "@/lib/topup-admin.functions";

/**
 * Blocks routes whose feature has been switched off in Admin → Maintenance.
 * Admins always pass through.
 */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const flagsQ = useFeatureFlags();
  const isAdminFn = useServerFn(checkIsAdmin);
  const adminQ = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => isAdminFn(),
    staleTime: 5 * 60_000,
  });

  const blocking = findBlockingFlag(pathname, flagsQ.data);
  if (!blocking || adminQ.data?.isAdmin) return <>{children}</>;

  const isGlobal = blocking.feature_key === "global";

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 py-12 text-center">
      <div className="space-y-4">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/15">
          <Wrench className="h-7 w-7 text-amber-500" />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight">
          {isGlobal ? "OpenPay Pro is under maintenance" : `${blocking.label} is under maintenance`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {blocking.message?.trim() ||
            "We're making improvements right now. Please check back shortly — your funds are safe."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {!isGlobal ? (
            <Button asChild className="rounded-full">
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/settings">Settings</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
