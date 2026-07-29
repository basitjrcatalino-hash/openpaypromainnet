import {
  createContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  fetchFxRates,
  getDisplayCurrencyCode,
  getFxTick,
  isKnownCurrency,
  setDisplayCurrency,
  subscribeDisplayCurrency,
  subscribeFxRates,
  type CurrencyCode,
} from "@/lib/currency";
import { fetchMajorUsdPrices } from "@/lib/ledger-majors";

const DisplayCurrencyContext = createContext<CurrencyCode>("USD");

/**
 * Wrap authenticated UI so currency changes re-render the tree and
 * formatUSD / formatCurrency stay in sync (Phantom-style).
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const code = useSyncExternalStore(
    subscribeDisplayCurrency,
    getDisplayCurrencyCode,
    () => "USD",
  );
  useSyncExternalStore(subscribeFxRates, getFxTick, () => 0);

  useEffect(() => {
    void Promise.all([fetchFxRates(), fetchMajorUsdPrices(["pi"])]);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        if (typeof window === "undefined") return;
        if (localStorage.getItem("op:currency")) return;
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const { data } = await supabase
          .from("user_preferences")
          .select("currency")
          .eq("user_id", auth.user.id)
          .maybeSingle();
        const pref = data?.currency;
        if (typeof pref === "string" && isKnownCurrency(pref)) {
          setDisplayCurrency(pref);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return (
    <DisplayCurrencyContext.Provider value={code}>{children}</DisplayCurrencyContext.Provider>
  );
}
