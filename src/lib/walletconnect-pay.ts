/**
 * WalletConnect Pay — OpenPay Pro wallet integration.
 * Docs: https://docs.walletconnect.com/payments/wallets/overview
 * Standalone Web SDK: https://docs.walletconnect.com/payments/wallets/standalone/web
 */

import { WalletConnectPay } from "@walletconnect/pay";
import type {
  Action,
  ConfirmPaymentResponse,
  PaymentOption,
  PaymentOptionsResponse,
} from "@walletconnect/pay";

export type {
  Action,
  ConfirmPaymentResponse,
  PaymentOption,
  PaymentOptionsResponse,
};

export const WALLETCONNECT_PAY_APP_ID =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_WALLETCONNECT_PAY_APP_ID ?? "").trim()) ||
  "6ec58826aff36e5e05f503b5deba5df5";

export const WALLETCONNECT_PAY_HOSTS = [
  "pay.walletconnect.com",
  "pay.walletconnect.org",
  "pay.reown.com",
] as const;

export const WC_PAY_EVM_CHAINS = [
  1, 10, 56, 137, 8453, 42161, 42220, 143,
] as const;

let clientSingleton: WalletConnectPay | null = null;

export function getWalletConnectPayClient(): WalletConnectPay {
  if (typeof window === "undefined") {
    throw new Error("WalletConnect Pay is browser-only");
  }
  if (!WalletConnectPay.isAvailable()) {
    throw new Error("WalletConnect Pay SDK is not available in this environment");
  }
  if (!clientSingleton) {
    clientSingleton = new WalletConnectPay({
      appId: WALLETCONNECT_PAY_APP_ID,
      logger: "warn",
    });
  }
  return clientSingleton;
}

export function isWalletConnectPayLink(raw: string): boolean {
  const text = raw.trim();
  if (!text) return false;
  if (/^pay_[A-Za-z0-9]+$/i.test(text)) return true;
  try {
    const url = new URL(text.startsWith("http") ? text : `https://${text}`);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (WALLETCONNECT_PAY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      return true;
    }
    if (host.includes("walletconnect") && (/\/pay/i.test(url.pathname) || url.searchParams.has("pid"))) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function normalizeWalletConnectPayLink(raw: string): string {
  const text = raw.trim();
  if (/^pay_[A-Za-z0-9]+$/i.test(text)) {
    return `https://pay.walletconnect.com/${text}`;
  }
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

export function caip10AccountsForAddress(address: string): string[] {
  const addr = address.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return [];
  return WC_PAY_EVM_CHAINS.map((id) => `eip155:${id}:${addr}`);
}

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
};

function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  return eth ?? null;
}

/** Connect a browser EVM wallet (MetaMask / Phantom EVM / etc.) for WC Pay signing. */
export async function connectEvmPayAccount(): Promise<string> {
  const eth = getEthereum();
  if (!eth) {
    throw new Error(
      "No browser EVM wallet found. Install MetaMask or enable Phantom’s Ethereum network to pay with WalletConnect Pay.",
    );
  }
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const addr = accounts?.[0];
  if (!addr) throw new Error("No EVM account returned from wallet");
  return addr;
}

export async function fetchPaymentOptions(
  paymentLink: string,
  accounts: string[],
): Promise<PaymentOptionsResponse> {
  const client = getWalletConnectPayClient();
  return client.getPaymentOptions({
    paymentLink: normalizeWalletConnectPayLink(paymentLink),
    accounts,
    includePaymentInfo: true,
  });
}

export async function fetchRequiredActions(
  paymentId: string,
  optionId: string,
): Promise<Action[]> {
  const client = getWalletConnectPayClient();
  return client.getRequiredPaymentActions({ paymentId, optionId });
}

export async function confirmWcPayment(params: {
  paymentId: string;
  optionId: string;
  signatures: string[];
}): Promise<ConfirmPaymentResponse> {
  const client = getWalletConnectPayClient();
  return client.confirmPayment(params);
}

/**
 * Sign WalletConnect Pay actions with the connected browser EVM wallet.
 * Supports eth_signTypedData_v4, personal_sign, eth_sendTransaction.
 */
export async function signPaymentActions(actions: Action[]): Promise<string[]> {
  const eth = getEthereum();
  if (!eth) throw new Error("Connect an EVM wallet before signing");

  const signatures: string[] = [];
  for (const action of actions) {
    const { chainId, method, params } = action.walletRpc;
    const parsed = JSON.parse(params) as unknown;
    const eip155 = chainId.includes(":") ? chainId.split(":")[1] : chainId;
    const hexChain = `0x${Number(eip155).toString(16)}`;

    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChain }],
      });
    } catch {
      /* wallet may already be on chain or reject — continue */
    }

    switch (method) {
      case "eth_signTypedData_v4": {
        const arr = parsed as [string, string | object];
        const from = arr[0];
        const data = typeof arr[1] === "string" ? arr[1] : JSON.stringify(arr[1]);
        const sig = (await eth.request({
          method: "eth_signTypedData_v4",
          params: [from, data],
        })) as string;
        signatures.push(sig);
        break;
      }
      case "personal_sign": {
        const arr = parsed as unknown[];
        const sig = (await eth.request({
          method: "personal_sign",
          params: arr,
        })) as string;
        signatures.push(sig);
        break;
      }
      case "eth_sendTransaction": {
        const arr = parsed as object[];
        const txHash = (await eth.request({
          method: "eth_sendTransaction",
          params: [arr[0]],
        })) as string;
        signatures.push(txHash);
        break;
      }
      default:
        throw new Error(`Unsupported WalletConnect Pay RPC method: ${method}`);
    }
  }
  return signatures;
}

export function buildCollectDataUrl(
  baseUrl: string,
  opts: { theme?: "light" | "dark" } = {},
): string {
  const theme = opts.theme ?? "dark";
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}theme=${theme}`;
}

export function waitForCollectDataComplete(timeoutMs = 5 * 60_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Data collection timed out"));
    }, timeoutMs);

    function handleMessage(event: MessageEvent) {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "IC_COMPLETE") {
          cleanup();
          resolve();
        } else if (data?.type === "IC_ERROR") {
          cleanup();
          reject(new Error(data.error || "Data collection failed"));
        }
      } catch {
        /* ignore non-JSON */
      }
    }

    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener("message", handleMessage);
    }

    window.addEventListener("message", handleMessage);
  });
}
