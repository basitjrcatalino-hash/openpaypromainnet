import { type ReactNode, useMemo } from "react";
import { Web3AuthProvider } from "@web3auth/modal/react";

import { getWeb3AuthContextConfig, WEB3AUTH_CLIENT_ID } from "@/lib/web3auth-config";

export function AppWeb3AuthProvider({ children }: { children: ReactNode }) {
  const config = useMemo(() => {
    if (!WEB3AUTH_CLIENT_ID) return null;
    try {
      return getWeb3AuthContextConfig();
    } catch {
      return null;
    }
  }, []);

  if (!config) return <>{children}</>;

  return <Web3AuthProvider config={config}>{children}</Web3AuthProvider>;
}
