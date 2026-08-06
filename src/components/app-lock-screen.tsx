import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, HelpCircle, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OPENPAY_AUTH_LOGO } from "@/lib/openpay-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  clearSessionUnlock,
  hashLockPassword,
  isSessionUnlocked,
  markSessionUnlocked,
  validateLockPassword,
} from "@/lib/app-lock";
import {
  hasBiometricCredential,
  isPlatformAuthenticatorAvailable,
  verifyBiometric,
} from "@/lib/biometric";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  children: ReactNode;
};

/**
 * App lock gate — unlock UI matches Blog / Wiki editorial (`opblog`) surface.
 * When a lock password is set, the wallet stays locked until Unlock succeeds
 * (or the user signs out via Forgot password).
 */
export function AppLockGate({ userId, children }: Props) {
  const [checking, setChecking] = useState(true);
  const [needsLock, setNeedsLock] = useState(false);
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const { data: hasPin } = await supabase.rpc("has_user_pin");
        if (cancelled) return;
        const required = !!hasPin;
        setNeedsLock(required);
        if (!required) {
          setLocked(false);
        } else {
          setLocked(!isSessionUnlocked(userId));
        }
      } catch {
        if (!cancelled) {
          setNeedsLock(false);
          setLocked(false);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void refresh();
    const onChanged = () => {
      void refresh();
    };
    window.addEventListener("openpay-lock-password-changed", onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("openpay-lock-password-changed", onChanged);
    };
  }, [userId]);

  // Relock after leaving the tab for a while (not instantly — avoids flash when
  // opening Pi / Helio / wallet sheets that briefly hide the document).
  useEffect(() => {
    if (!needsLock) return;
    let hideAt = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hideAt = Date.now();
        return;
      }
      if (hideAt && Date.now() - hideAt > 60_000) {
        clearSessionUnlock(userId);
        setLocked(true);
      }
      hideAt = 0;
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [needsLock, userId]);

  useEffect(() => {
    const onLock = () => {
      clearSessionUnlock(userId);
      setLocked(true);
    };
    window.addEventListener("openpay-lock-wallet", onLock);
    return () => window.removeEventListener("openpay-lock-wallet", onLock);
  }, [userId]);

  if (checking) {
    return (
      <div className="opblog grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (needsLock && locked) {
    return (
      <AppLockScreen
        userId={userId}
        onUnlocked={() => {
          markSessionUnlocked(userId);
          setLocked(false);
        }}
      />
    );
  }

  return <>{children}</>;
}

export function requestWalletLock() {
  window.dispatchEvent(new Event("openpay-lock-wallet"));
}

export function notifyLockPasswordChanged() {
  window.dispatchEvent(new Event("openpay-lock-password-changed"));
}

function AppLockScreen({
  userId,
  onUnlocked,
}: {
  userId: string;
  onUnlocked: () => void;
}) {
  const inputId = useId();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!hasBiometricCredential(userId)) return;
      const ok = await isPlatformAuthenticatorAvailable();
      if (!cancelled && ok) setBioAvailable(true);
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function unlockWithBiometrics() {
    setBioBusy(true);
    setError(null);
    try {
      const ok = await verifyBiometric(userId);
      if (ok) onUnlocked();
      else setError("Biometric check failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Biometric check cancelled");
    } finally {
      setBioBusy(false);
    }
  }

  // Offer the biometric prompt immediately when it's set up on this device.
  useEffect(() => {
    if (bioAvailable) void unlockWithBiometrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioAvailable]);

  async function unlock(e?: FormEvent) {
    e?.preventDefault();
    const invalid = validateLockPassword(password);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const hash = await hashLockPassword(userId, password);
      const { data, error: rpcErr } = await supabase.rpc("verify_user_pin", {
        _pin_hash: hash,
      });
      if (rpcErr) throw rpcErr;
      if (!data) {
        setError("Incorrect password");
        return;
      }
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock");
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    await supabase.auth.signOut();
    toast.message("Signed out — set a new lock password in Settings → Security after you sign in.");
    window.location.href = "/authpi";
  }

  return (
    <main className="opblog flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-16 pt-8 sm:px-8">
        <nav className="mb-10 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Link
              to="/authpi"
              className="rounded-full bg-[var(--muted)] px-3 py-1.5 text-[var(--foreground)]/80 hover:text-[var(--foreground)]"
            >
              OpenPay Pro
            </Link>
            <span className="text-[var(--muted-foreground)]">›</span>
            <span className="rounded-full bg-[var(--muted)] px-3 py-1.5">Unlock</span>
          </div>
          <Link
            to="/docs/faq"
            className="grid h-9 w-9 place-items-center rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
            aria-label="Help"
          >
            <HelpCircle className="h-4.5 w-4.5" strokeWidth={1.75} />
          </Link>
        </nav>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Wallet security
          </p>
          <h1 className="opblog-title mt-3 text-[clamp(2rem,6vw,2.75rem)]">Enter your password</h1>
          <p className="opblog-dek mt-4 text-[var(--muted-foreground)]">
            Unlock to open your dashboard
          </p>

          <div
            className="relative mt-8 grid aspect-[16/9] place-items-center overflow-hidden rounded-3xl"
            style={{
              backgroundImage: "linear-gradient(135deg, #efeafc, #ddd6fe 55%, #c4b5fd)",
            }}
            aria-hidden
          >
            <img
              src={OPENPAY_AUTH_LOGO}
              alt=""
              className="h-20 w-20 rounded-[1.35rem] object-contain shadow-[0_16px_40px_rgba(61,46,99,0.18)] sm:h-24 sm:w-24"
            />
            <span className="absolute bottom-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-white/70 text-[var(--foreground)] shadow-sm backdrop-blur-sm">
              <Lock className="h-4.5 w-4.5" strokeWidth={2} />
            </span>
          </div>

          <form
            onSubmit={unlock}
            className="mt-8 space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6"
          >
            <div className="relative">
              <label htmlFor={inputId} className="sr-only">
                Password
              </label>
              <Input
                id={inputId}
                type={show ? "text" : "password"}
                autoFocus
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                className={cn(
                  "h-14 rounded-2xl border-[var(--border)] bg-[var(--muted)] px-4 pr-12 text-[15px] text-[var(--foreground)]",
                  "placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]/30",
                )}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error ? (
              <p className="text-center text-sm font-semibold text-red-600">{error}</p>
            ) : null}

            <Button
              type="submit"
              disabled={busy || password.length < 6}
              className="h-14 w-full rounded-full bg-[var(--primary)] text-[16px] font-bold text-[var(--primary-foreground)] hover:brightness-105 disabled:opacity-40"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Unlock
            </Button>

            {bioAvailable ? (
              <Button
                type="button"
                variant="outline"
                disabled={bioBusy}
                onClick={() => void unlockWithBiometrics()}
                className="h-14 w-full rounded-full border-[var(--border)] bg-[var(--muted)] text-[16px] font-bold text-[var(--foreground)]"
              >
                {bioBusy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Fingerprint className="mr-2 h-4.5 w-4.5" />
                )}
                Unlock with Face ID / Fingerprint
              </Button>
            ) : null}
          </form>

          <button
            type="button"
            onClick={() => void forgot()}
            className="mt-6 text-center text-[15px] font-bold text-[var(--foreground)] underline-offset-4 press hover:underline"
          >
            Forgot password
          </button>
        </div>
      </div>
    </main>
  );
}
