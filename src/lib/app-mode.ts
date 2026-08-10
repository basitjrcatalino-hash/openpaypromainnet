import { useCallback, useEffect, useState } from "react";

/** OKX-style top-level app mode: Exchange (markets/trading) vs Web3 (wallet). */
export type AppMode = "exchange" | "web3";

const KEY = "op.app.mode";
const EVENT = "op:app-mode";

/** Shared across every hook instance so header, tabbar and pages stay in sync. */
let current: AppMode = "web3";
const listeners = new Set<(m: AppMode) => void>();

function broadcast(next: AppMode) {
  current = next;
  listeners.forEach((l) => l(next));
}

export function useAppMode() {
  // Always start on the wallet so SSR and the first client render agree.
  const [mode, setModeState] = useState<AppMode>("web3");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (stored === "exchange" || stored === "web3") current = stored;
    } catch {
      /* storage blocked */
    }
    setModeState(current);

    const onChange = (m: AppMode) => setModeState(m);
    listeners.add(onChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && (e.newValue === "exchange" || e.newValue === "web3")) {
        broadcast(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setMode = useCallback((next: AppMode) => {
    broadcast(next);
    try {
      window.localStorage.setItem(KEY, next);
      window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
    } catch {
      /* storage blocked */
    }
  }, []);

  return { mode, setMode };
}
