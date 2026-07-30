// Pi Network SDK helper (browser-only).
// Handles auth + U2A payments. Pi.init() is awaited before authenticate/createPayment,
// and incomplete payments are always completed via the backend.

import { supabase } from "@/integrations/supabase/client";

type PiPayment = { identifier: string; [k: string]: unknown };

declare global {
  interface Window {
    Pi?: {
      init: (opts: { version: string; sandbox?: boolean }) => unknown;
      authenticate: (
        scopes: string[],
        onIncompletePaymentFound: (payment: PiPayment) => void,
      ) => Promise<{
        accessToken: string;
        user: { uid: string; username: string; wallet_address?: string };
      }>;
      createPayment: (
        payment: {
          amount: number;
          memo: string;
          metadata: Record<string, unknown>;
        },
        callbacks: {
          onReadyForServerApproval: (paymentId: string) => void;
          onReadyForServerCompletion: (paymentId: string, txid: string) => void;
          onCancel: (paymentId: string) => void;
          onError: (error: Error, payment?: PiPayment) => void;
        },
      ) => void;
    };
  }
}

const SDK_URL = "https://sdk.minepi.com/pi-sdk.js";
const SCOPES = ["username", "payments"];
const LINK_SCOPES = ["username", "payments", "wallet_address"];
let sdkPromise: Promise<void> | null = null;
let initPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Pi SDK requires browser"));
  if (window.Pi) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Pi SDK")));
      return;
    }
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Pi SDK"));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

async function ensureInit(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await loadSdk();
    if (!window.Pi) throw new Error("Pi SDK unavailable");
    const { isPiSandbox } = await import("@/lib/piSdk");
    // Match A2U / Pi Browser sandbox setting so auth tokens validate against /v2/me.
    await Promise.resolve(window.Pi.init({ version: "2.0", sandbox: isPiSandbox() }));
  })();
  return initPromise;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function completeIncomplete(payment: PiPayment) {
  try {
    const txid = (payment as { transaction?: { txid?: string } }).transaction?.txid;
    const res = await fetch("/api/public/pi-payments/incomplete", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await getAuthHeader()) },
      body: JSON.stringify({ paymentId: payment.identifier, txid }),
    });
    if (!res.ok) console.warn("[Pi] incomplete completion failed", await res.text());
  } catch (err) {
    console.warn("[Pi] incomplete completion error", err);
  }
}

export async function signInWithPi(): Promise<{ username: string }> {
  await ensureInit();
  if (!window.Pi) throw new Error("Pi SDK unavailable");

  const auth = await window.Pi.authenticate(SCOPES, (payment) => {
    void completeIncomplete(payment);
  });

  const res = await fetch("/api/public/pi-auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      accessToken: auth.accessToken,
      walletAddress: auth.user.wallet_address,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || "Pi backend validation failed");
  }
  const { email, password, username } = (await res.json()) as {
    email: string; password: string; username: string;
  };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { username };
}

/**
 * Link the current OpenPay Pro user's Pi Network wallet via Pi Auth (wallet_address scope).
 * Must run in Pi Browser. Stores profiles.pi_wallet_address — no manual paste.
 */
export async function linkPiWallet(): Promise<{
  pi_username: string;
  pi_wallet_address: string;
}> {
  await ensureInit();
  if (!window.Pi) throw new Error("Pi SDK unavailable — open this page in the Pi Browser");

  const auth = await window.Pi.authenticate(LINK_SCOPES, (payment) => {
    void completeIncomplete(payment);
  });

  const walletAddress = auth.user.wallet_address?.trim();
  if (!walletAddress) {
    throw new Error(
      "Pi did not share a wallet address. Allow the wallet_address permission in Pi Browser and try again.",
    );
  }

  const res = await fetch("/api/public/pi-link-wallet", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(await getAuthHeader()),
    },
    body: JSON.stringify({
      accessToken: auth.accessToken,
      walletAddress,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || "Failed to link Pi wallet");
  }
  const data = (await res.json()) as {
    pi_username: string;
    pi_wallet_address: string;
  };
  return data;
}

/**
 * Pi payment memo shown in the Pi wallet — keep in sync with createPayment.
 */
export function buildPiTopupMemo(
  ousdAmount: number,
  piAmount: number,
  piUsdPrice: number,
): string {
  const ousd = Number(ousdAmount.toFixed(2));
  const pi =
    piAmount >= 1 ? piAmount.toFixed(4) : piAmount.toPrecision(6);
  const price =
    piUsdPrice >= 0.01 ? piUsdPrice.toFixed(4) : piUsdPrice.toPrecision(4);
  return `OpenPay Pro: ${ousd} OUSD (~${pi} π @ $${price})`;
}

export type PiTopupQuote = {
  ousdAmount: number;
  piAmount: number;
  piUsdPrice: number;
  memo: string;
};

/** Live π quote for an OUSD/$ top-up (1 OUSD = $1). */
export async function quotePiTopup(ousdAmount: number): Promise<PiTopupQuote> {
  if (!(ousdAmount > 0)) throw new Error("Enter a valid OUSD amount");
  const { fetchMajorUsdPrices, piAmountForOusd } = await import("@/lib/ledger-majors");
  const prices = await fetchMajorUsdPrices(["pi"]);
  const piUsdPrice = prices.pi;
  if (!(piUsdPrice > 0)) throw new Error("Could not fetch live Pi price");
  const piAmount = piAmountForOusd(ousdAmount, piUsdPrice);
  if (!(piAmount > 0)) throw new Error("Amount too small for current Pi price");
  return {
    ousdAmount,
    piAmount,
    piUsdPrice,
    memo: buildPiTopupMemo(ousdAmount, piAmount, piUsdPrice),
  };
}

/**
 * Create a Pi U2A payment that tops up the user's OUSD balance.
 * Charges live market PI for the requested OUSD amount (1 OUSD = $1).
 */
export async function topUpWithPi(ousdAmount: number): Promise<{ paymentId: string; txid: string; piAmount: number; piUsdPrice: number }> {
  await ensureInit();
  if (!window.Pi) throw new Error("Pi SDK unavailable");

  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) throw new Error("Sign in first to top up with Pi");

  const quote = await quotePiTopup(ousdAmount);
  const { piAmount, piUsdPrice, memo } = quote;

  // Ensure auth scope includes "payments" (re-auth is cheap and idempotent for already-signed-in Pi users).
  await window.Pi.authenticate(SCOPES, (payment) => {
    void completeIncomplete(payment);
  });

  return await new Promise<{ paymentId: string; txid: string; piAmount: number; piUsdPrice: number }>((resolve, reject) => {
    const metadata = {
      product: "ousd_topup",
      ousdAmount,
      piUsdPrice,
      supabaseUserId: sess.session!.user.id,
    };
    let lastPaymentId = "";

    window.Pi!.createPayment(
      {
        amount: piAmount,
        memo,
        metadata,
      },
      {
        onReadyForServerApproval: async (paymentId) => {
          lastPaymentId = paymentId;
          const res = await fetch("/api/public/pi-payments/approve", {
            method: "POST",
            headers: { "content-type": "application/json", ...(await getAuthHeader()) },
            body: JSON.stringify({ paymentId }),
          });
          if (!res.ok) {
            const t = await res.text();
            reject(new Error(`Approval failed: ${t}`));
          }
        },
        onReadyForServerCompletion: async (paymentId, txid) => {
          const res = await fetch("/api/public/pi-payments/complete", {
            method: "POST",
            headers: { "content-type": "application/json", ...(await getAuthHeader()) },
            body: JSON.stringify({ paymentId, txid }),
          });
          if (!res.ok) {
            const t = await res.text();
            reject(new Error(`Completion failed: ${t}`));
            return;
          }
          resolve({ paymentId, txid, piAmount, piUsdPrice });
        },
        onCancel: (paymentId) => {
          reject(new Error(`Payment cancelled (${paymentId || lastPaymentId})`));
        },
        onError: (error, payment) => {
          if (payment) void completeIncomplete(payment);
          reject(error);
        },
      },
    );
  });
}
