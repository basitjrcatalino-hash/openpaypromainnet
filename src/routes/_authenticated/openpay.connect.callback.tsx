import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { completeOpenPayConnect } from "@/lib/openpay-pro.functions";

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
  const complete = useServerFn(completeOpenPayConnect);
  const [status, setStatus] = useState("Confirming your OpenPay account…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (search.error) {
        toast.error(search.error);
        navigate({ to: "/settings" });
        return;
      }
      if (!search.code || !search.state) {
        toast.error("Missing OpenPay connect code");
        navigate({ to: "/settings" });
        return;
      }
      try {
        const link = await complete({
          data: { code: search.code, state: search.state },
        });
        if (cancelled) return;
        setStatus("Connected");
        toast.success(
          `Connected OpenPay ${link.username ? `@${link.username}` : (link.name ?? link.account_number ?? "")}`,
        );
        void qc.invalidateQueries({ queryKey: ["prefs"] });
        void qc.invalidateQueries({ queryKey: ["user-prefs"] });
        navigate({ to: "/settings" });
      } catch (e) {
        if (cancelled) return;
        toast.error((e as Error).message || "Connect failed");
        navigate({ to: "/settings" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.code, search.state, search.error]);

  return (
    <div className="mx-auto grid max-w-md place-items-center py-20">
      <Card className="glass-strong flex w-full items-center gap-3 rounded-3xl border-border/60 p-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm font-medium">{status}</p>
      </Card>
    </div>
  );
}
