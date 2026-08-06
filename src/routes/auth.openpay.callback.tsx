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
    error_description: typeof s.error_description === "string" ? s.error_description : undefined,
  }),
  component: OpenPayAuthCallbackPage,
});

/** Survives React Strict Mode remounts (unlike useRef). */
const exchangedCodes = new Set<string>();

function isUselessErrorText(s: string) {
  const t = s.trim();
  return (
    !t ||
    t === "0" ||
    t === "()" ||
    t === "null" ||
    t === "undefined" ||
    /^\d+$/.test(t) ||
    /^[\s()]+$/.test(t) ||
    /^OpenPay sign-in failed\s*\(\s*\)$/i.test(t)
  );
}

/** Never show bare "0" / "()" / numeric junk from upstream APIs. */
function humanizeOpenPayError(raw: unknown, fallback: string): string {
  if (raw == null) return fallback;
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    // Prefer real fields; skip empty strings (?? does not).
    const pick = [o.error_description, o.message, o.error, o.msg].find(
      (v) => typeof v === "string" && !isUselessErrorText(v),
    );
    if (pick) return String(pick).trim();
    const nested = [o.error_description, o.message, o.error, o.msg].find(
      (v) => v != null && typeof v === "object",
    );
    if (nested) return humanizeOpenPayError(nested, fallback);
    return fallback;
  }
  const s = String(raw).trim();
  if (isUselessErrorText(s)) return fallback;
  return s;
}

function OpenPayAuthCallbackPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const redirect = sessionStorage.getItem("openpay_oauth_redirect") || "/dashboard";

    (async () => {
      if (search.error) {
        const denied = /access_denied/i.test(search.error);
        setError(
          denied
            ? "Sign-in cancelled — you denied OpenPay access."
            : humanizeOpenPayError(
                search.error_description || search.error,
                search.error.trim()
                  ? `OpenPay sign-in failed: ${search.error}`
                  : "OpenPay sign-in failed",
              ),
        );
        return;
      }
      if (!search.code || !search.state) {
        setError("Missing authorization code from OpenPay. Start again from sign-in.");
        return;
      }

      if (exchangedCodes.has(search.code)) {
        // In-flight or already finished from a Strict Mode double-mount — wait, don't error.
        return;
      }
      exchangedCodes.add(search.code);

      const savedState = sessionStorage.getItem("openpay_oauth_state");
      if (savedState && savedState !== search.state) {
        exchangedCodes.delete(search.code);
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

        let body: {
          email?: string;
          password?: string;
          username?: string;
          error?: unknown;
        } = {};
        const text = await res.text();
        try {
          body = text ? (JSON.parse(text) as typeof body) : {};
        } catch {
          body = {};
        }

        if (!res.ok || !body.email || !body.password) {
          const msg = humanizeOpenPayError(
            body.error,
            res.status
              ? `OpenPay sign-in failed (HTTP ${res.status})`
              : "OpenPay sign-in failed (network error)",
          );
          if (!body.error && text) {
            setDetail(text.slice(0, 160));
          }
          throw new Error(msg);
        }

        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: body.email,
          password: body.password,
        });
        if (signInErr) {
          throw new Error(
            humanizeOpenPayError(signInErr.message, "Could not create your Pro session"),
          );
        }

        toast.success(
          body.username
            ? `Signed in as @${body.username.replace(/^@/, "")} via OpenPay`
            : "Signed in with OpenPay",
        );
        sessionStorage.removeItem("openpay_oauth_redirect");
        sessionStorage.removeItem("openpay_oauth_started_local");
        window.location.replace(redirect);
      } catch (e) {
        exchangedCodes.delete(search.code);
        setError(
          humanizeOpenPayError((e as Error)?.message || e, "OpenPay sign-in failed — try again"),
        );
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
            {detail ? (
              <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground/80">
                {detail}
              </p>
            ) : null}
            <p className="mt-3 text-[11px] text-muted-foreground">
              Tip: use{" "}
              <a href="https://openpaypro.space/authpi" className="underline">
                openpaypro.space/authpi
              </a>{" "}
              (not localhost) so OAuth callback matches your Partner app redirect URI.
            </p>
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
            <p className="mt-4 text-sm text-muted-foreground">Signing you in via OpenPay…</p>
          </>
        )}
      </div>
    </div>
  );
}
