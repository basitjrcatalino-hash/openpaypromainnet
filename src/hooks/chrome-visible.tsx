import { createContext, useContext } from "react";

const ChromeVisibleContext = createContext(true);

export const ChromeVisibleProvider = ChromeVisibleContext.Provider;

export function useChromeVisible() {
  return useContext(ChromeVisibleContext);
}
