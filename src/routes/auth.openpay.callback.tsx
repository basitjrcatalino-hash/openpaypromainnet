import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/openpay/callback")({
  ssr: false,
  head: () => ({ meta: [{ title: "OpenPay Sign-In — OpenPay Pro" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : undefined,
    state: typeof s.state === "string" ? s.state : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
    error_description:
      typeof s.error_description === "string" ? s.error_description : undefined,
  }),
  component: OpenPayAuthCallbackPage,
});

function OpenPayAuthCallbackPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      if (search.error) {
        const denied = /access_denied/i.test(search.error);
        setError(
          denied
            ? "Sign-in cancelled — you denied OpenPay access."
            : search.error_description || `OpenPay sign-in failed: ${search.error}`,
        );
        return;
      }
      if (!search.code || !search.state) {
        setError("Missing authorization code from OpenPay.");
        return;
      }

      const savedState = sessionStorage.getItem("openpay_oauth_state");
      if (savedState && savedState !== search.state) {
        setError("State mismatch — possible CSRF. Please try again.");
        return;
      }
      sessionStorage.removeItem("openpay_oauth_state");

      try {
        const res = await fetch("/api/public/openpay-auth", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: search.code, state: search.state }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          email?: string;
          password?: string;
          username?: string;
          error?: string;
        };
        if (!res.ok || !body.email || !body.password) {
          throw new Error(body.error || `OpenPay sign-in failed (${res.status})`);
        }

        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: body.email,
          password: body.password,
        });
        if (signInErr) throw signInErr;

        toast.success(
          body.username
            ? `Signed in as @${body.username.replace(/^@/, "")} via OpenPay`
            : "Signed in with OpenPay",
        );
        const redirect = sessionStorage.getItem("openpay_oauth_redirect") || "/dashboard";
        sessionStorage.removeItem("openpay_oauth_redirect");
        navigate({ to: redirect });
      } catch (e) {
        setError((e as Error).message || "OpenPay sign-in failed");
      }
    })();
  }, [navigate, search.code, search.state, search.error, search.error_description]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-destructive">OpenPay sign-in</h1>
            <p className="mt-3 text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => navigate({ to: "/authpi" })}
              className="mt-6 rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
            >
              Back to sign-in
            </button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Finishing OpenPay sign-in…</p>
          </>
        )}
      </div>
    </div>
  );
}
