import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const POST_AUTH_KEY = "post_auth_redirect";

function postAuthTarget(): string {
  try {
    const v = sessionStorage.getItem(POST_AUTH_KEY);
    if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  } catch {
    /* ignore */
  }
  return "/dashboard";
}

export function captureEmailAuthNextParam() {
  try {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      sessionStorage.setItem(POST_AUTH_KEY, next);
    }
  } catch {
    /* ignore */
  }
}

function goPostAuth() {
  const target = postAuthTarget();
  try {
    sessionStorage.removeItem(POST_AUTH_KEY);
  } catch {
    /* ignore */
  }
  window.location.assign(target);
}

function emailAuthRedirectUrl(): string {
  if (typeof window === "undefined") return "/auth";
  const next = postAuthTarget();
  const u = new URL("/auth", window.location.origin);
  if (next && next !== "/dashboard") u.searchParams.set("next", next);
  return u.toString();
}

function friendlyEmailAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("email not confirmed") || m.includes("not confirmed")) {
    return "Confirm your email first — check your inbox, then sign in.";
  }
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Wrong email or password.";
  }
  if (m.includes("user already registered")) {
    return "That email already has an account — sign in instead.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts — wait a moment and try again.";
  }
  return message || "Email sign-in failed";
}

export function EmailAuthPanel({
  busy,
  setBusy,
  initialMode = "signin",
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  initialMode?: "signin" | "signup";
}) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) {
      toast.error("Enter your email and password");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: trimmed,
          password,
          options: {
            data: { provider: "email" },
            emailRedirectTo: emailAuthRedirectUrl(),
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created");
          goPostAuth();
          return;
        }
        toast.success("Check your email to confirm your account, then sign in");
        setMode("signin");
        setBusy(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) throw error;
      goPostAuth();
    } catch (err) {
      toast.error(friendlyEmailAuthError((err as Error).message));
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (busy) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error("Enter your email above, then tap Forgot password");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: emailAuthRedirectUrl(),
      });
      if (error) throw error;
      setResetSent(true);
      toast.success("Password reset link sent — check your email");
    } catch (err) {
      toast.error(friendlyEmailAuthError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <Input
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@email.com"
        value={email}
        disabled={busy}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-muted-foreground"
      />
      <Input
        type="password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        placeholder="Password"
        value={password}
        disabled={busy}
        onChange={(e) => setPassword(e.target.value)}
        className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-muted-foreground"
      />
      <Button
        type="submit"
        disabled={busy}
        className="h-12 w-full rounded-full text-base font-semibold"
        style={{ backgroundColor: "#6366f1", color: "#fff" }}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : mode === "signin" ? (
          "Sign in with email"
        ) : (
          "Create account"
        )}
      </Button>
      {mode === "signin" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void forgotPassword()}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {resetSent ? "Reset email sent — check your inbox" : "Forgot password?"}
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
