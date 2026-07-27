import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/openpay/connect/callback")({
  head: () => ({ meta: [{ title: "Connecting OpenPay…" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : undefined,
    state: typeof s.state === "string" ? s.state : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  component: OpenPayConnectCallback,
});

function OpenPayConnectCallback() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const ran = useRef(false);
  const [status, setStatus] = useState("Confirming your OpenPay account…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      if (search.error) {
        const msg = /invalid_client/i.test(search.error)
          ? "OpenPay rejected the app credentials (invalid_client). Check OPENPAY_PARTNER_API_KEY."
          : search.error;
        setError(msg);
        toast.error(msg);
        return;
      }
      if (!search.code || !search.state) {
        setError("Missing OpenPay connect code");
        toast.error("Missing OpenPay connect code");
        return;
      }
      try {
        // Dynamically import to keep the server function lazy-loaded
        const { completeOpenPayConnect } = await import("@/lib/openpay-pro.functions");
        const link = await completeOpenPayConnect({
          data: { code: search.code, state: search.state },
        });
        setStatus("Connected!");
        toast.success(
          `Connected OpenPay ${link.username ? `@${link.username}` : (link.name ?? link.account_number ?? "")}`,
        );
        void qc.invalidateQueries({ queryKey: ["prefs"] });
        void qc.invalidateQueries({ queryKey: ["user-prefs"] });
        void qc.invalidateQueries({ queryKey: ["openpay-link"] });
        // Hard redirect to settings so the authenticated layout re-renders cleanly
        window.location.replace("/settings");
      } catch (e) {
        const msg = (e as Error).message || "Connect failed";
        setError(msg);
        toast.error(msg);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.code, search.state, search.error]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-destructive">OpenPay Connect</h1>
          <p className="mt-3 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/settings" })}
            className="mt-6 rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
          >
            Back to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-md place-items-center py-20">
      <Card className="glass-strong flex w-full items-center gap-3 rounded-3xl border-border/60 p-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm font-medium">{status}</p>
      </Card>
    </div>
  );
}
