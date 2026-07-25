import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/pi/callback")({
  ssr: false,
  head: () => ({ meta: [{ title: "Pi Sign-In — OpenPay Pro" }] }),
  component: PiCallbackPage,
});

function parseFragment(hash: string): Record<string, string> {
  const out: Record<string, string> = {};
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!h) return out;
  for (const part of h.split("&")) {
    const [k, v] = part.split("=");
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  }
  return out;
}

function PiCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const frag = parseFragment(window.location.hash);
      // Some providers put error/token in query string too; check both.
      const search = new URLSearchParams(window.location.search);
      const accessToken = frag.access_token || search.get("access_token") || "";
      const returnedState = frag.state || search.get("state") || "";
      const errParam = frag.error || search.get("error");

      if (errParam) {
        setError(`Pi sign-in failed: ${errParam}`);
        return;
      }
      if (!accessToken) {
        setError("Missing access token from Pi.");
        return;
      }

      const savedState = sessionStorage.getItem("pi_oauth_state");
      if (savedState && returnedState && savedState !== returnedState) {
        setError("State mismatch — possible CSRF. Please try again.");
        return;
      }
      sessionStorage.removeItem("pi_oauth_state");

      try {
        const res = await fetch("/api/public/pi-auth", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          email?: string;
          password?: string;
          username?: string;
          error?: string;
        };
        if (!res.ok || !body.email || !body.password) {
          throw new Error(body.error || `Pi backend validation failed (${res.status})`);
        }
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: body.email,
          password: body.password,
        });
        if (signInErr) throw signInErr;

        toast.success(`Signed in as @${body.username}`);
        const redirect = sessionStorage.getItem("pi_oauth_redirect") || "/dashboard";
        sessionStorage.removeItem("pi_oauth_redirect");
        navigate({ to: redirect });
      } catch (e) {
        setError((e as Error).message || "Pi sign-in failed");
      }
    })();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-destructive">Pi sign-in error</h1>
            <p className="mt-3 text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate({ to: "/authpi" })}
              className="mt-6 rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
            >
              Back to sign-in
            </button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              Finishing Pi sign-in…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
