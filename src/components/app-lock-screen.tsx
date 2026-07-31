import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, HelpCircle, Loader2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  children: ReactNode;
};

/**
 * Phantom-style app lock gate.
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

  // Relock when the tab is hidden (leave dashboard / switch apps).
  useEffect(() => {
    if (!needsLock) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        clearSessionUnlock(userId);
        setLocked(true);
      }
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
      <div className="grid min-h-dvh place-items-center bg-black text-white">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
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
  const [error, setError] = useState<string | null>(null);

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
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
        <span className="flex-1" aria-hidden />
        <span
          className="text-[15px] font-bold lowercase tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          openpay
        </span>
        <Link
          to="/docs/faq"
          className="flex flex-1 justify-end"
          aria-label="Help"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full text-white/45 hover:bg-white/10 hover:text-white/80">
            <HelpCircle className="h-5 w-5" strokeWidth={1.75} />
          </span>
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center px-6 pb-10 pt-16">
        <img
          src={OPENPAY_AUTH_LOGO}
          alt=""
          className="h-28 w-28 rounded-[2rem] object-contain drop-shadow-[0_20px_50px_rgba(171,159,242,0.35)]"
        />
        <h1 className="mt-10 text-center text-[1.65rem] font-bold tracking-tight">
          Enter your password
        </h1>
        <p className="mt-2 max-w-[16rem] text-center text-sm text-white/50">
          Unlock to open your dashboard
        </p>

        <form onSubmit={unlock} className="mt-8 w-full space-y-4">
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
                "h-14 rounded-2xl border-white/12 bg-white/8 px-4 pr-12 text-[15px] text-white",
                "placeholder:text-white/35 focus-visible:ring-white/25",
              )}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-white/45 hover:text-white"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error ? (
            <p className="text-center text-sm font-medium text-red-400">{error}</p>
          ) : null}

          <Button
            type="submit"
            disabled={busy || password.length < 6}
            className="mt-2 h-14 w-full rounded-full bg-[#AB9FF2] text-[16px] font-bold text-black hover:bg-[#B8B0FF] disabled:opacity-40"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Unlock
          </Button>
        </form>

        <button
          type="button"
          onClick={() => void forgot()}
          className="mt-6 text-[15px] font-bold text-white press"
        >
          Forgot password
        </button>
      </div>
    </div>
  );
}
