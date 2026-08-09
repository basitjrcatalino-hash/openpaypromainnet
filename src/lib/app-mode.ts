import { useCallback, useEffect, useState } from "react";

/** OKX-style top-level app mode: Exchange (markets/trading) vs Web3 (wallet). */
export type AppMode = "exchange" | "web3";

const KEY = "op.app.mode";

export function useAppMode() {
  // Always start on the wallet so SSR and the first client render agree.
  const [mode, setModeState] = useState<AppMode>("web3");

  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) === "exchange") setModeState("exchange");
    } catch {
      /* storage blocked */
    }
  }, []);

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* storage blocked */
    }
  }, []);

  return { mode, setMode };
}
