/**
 * useWallet — React hook for Circle / provider-backed crypto wallets.
 * Auto-provisions a wallet when configured; exposes refresh helpers.
 */

import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ensureCryptoWallet,
  getCryptoWalletDashboard,
} from "@/lib/circle-wallet.functions";
import type {
  CryptoTransactionRecord,
  CryptoWalletRecord,
  TokenBalance,
} from "@/lib/wallet-providers/types";

export type UseWalletResult = {
  wallet: CryptoWalletRecord | null;
  balance: TokenBalance[];
  transactions: CryptoTransactionRecord[];
  loading: boolean;
  error: string | null;
  configured: boolean;
  refreshWallet: () => Promise<void>;
};

export function useWallet(): UseWalletResult {
  const ensureFn = useServerFn(ensureCryptoWallet);
  const dashFn = useServerFn(getCryptoWalletDashboard);

  const [wallet, setWallet] = useState<CryptoWalletRecord | null>(null);
  const [balance, setBalance] = useState<TokenBalance[]>([]);
  const [transactions, setTransactions] = useState<CryptoTransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);

  const refreshWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Provision if missing (no-op when already exists)
      try {
        await ensureFn();
      } catch (err) {
        const msg = (err as Error).message || "";
        if (/not configured/i.test(msg)) {
          setConfigured(false);
          setWallet(null);
          setBalance([]);
          setTransactions([]);
          setError(msg);
          return;
        }
        // Continue to dashboard fetch even if ensure fails transiently
        console.warn("[useWallet] ensure", err);
      }

      const dash = (await dashFn()) as {
        wallet: CryptoWalletRecord | null;
        balances: TokenBalance[];
        transactions: CryptoTransactionRecord[];
        configured: boolean;
      };
      setConfigured(dash.configured);
      setWallet(dash.wallet);
      setBalance(dash.balances);
      setTransactions(dash.transactions);
      if (!dash.configured) {
        setError("Circle is not configured on the server.");
      }
    } catch (err) {
      setError((err as Error).message || "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, [ensureFn, dashFn]);

  useEffect(() => {
    void refreshWallet();
  }, [refreshWallet]);

  return {
    wallet,
    balance,
    transactions,
    loading,
    error,
    configured,
    refreshWallet,
  };
}
