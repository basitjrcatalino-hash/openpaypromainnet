// Pi Network SDK helper (browser-only).
// Loads the Pi SDK script, awaits Pi.init(), runs authenticate with "username" scope,
// validates the access token against our backend, then signs the user into Supabase.

import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Pi?: {
      init: (opts: { version: string; sandbox?: boolean }) => unknown;
      authenticate: (
        scopes: string[],
        onIncompletePaymentFound: (payment: unknown) => void,
      ) => Promise<{ accessToken: string; user: { uid: string; username: string } }>;
    };
  }
}

const SDK_URL = "https://sdk.minepi.com/pi-sdk.js";
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
    // Pi.init may return a Promise — await it fully before authenticate().
    await Promise.resolve(window.Pi.init({ version: "2.0", sandbox: true }));
  })();
  return initPromise;
}

export async function signInWithPi(): Promise<{ username: string }> {
  await ensureInit();
  if (!window.Pi) throw new Error("Pi SDK unavailable");

  const auth = await window.Pi.authenticate(["username"], (payment) => {
    console.warn("[Pi] Incomplete payment found", payment);
  });

  const res = await fetch("/api/public/pi-auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessToken: auth.accessToken }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || "Pi backend validation failed");
  }
  const { email, password, username } = (await res.json()) as {
    email: string;
    password: string;
    username: string;
  };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { username };
}
