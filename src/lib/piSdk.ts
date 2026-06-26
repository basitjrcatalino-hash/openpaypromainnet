// Pi SDK helpers for A2U flow (testnet reward). Browser-only.

const PI_AUTH_STORAGE_KEY = "openpay_pi_auth";
const SDK_URL = "https://sdk.minepi.com/pi-sdk.js";

export type PiAuthSession = { uid: string; username: string; accessToken: string };

// Window.Pi is already typed in src/lib/pi-network.ts

export function isPiSandbox(): boolean {
  const env = String(import.meta.env.VITE_PI_SANDBOX ?? "").trim().toLowerCase();
  if (env.length > 0) return env === "true";
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  if (host.includes("testnet") || window.location.pathname.includes("testnet")) return true;
  if (import.meta.env.PROD) return true; // Pi Testnet A2U flow uses sandbox
  return true;
}

export function isPiBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return /PiBrowser/i.test(navigator.userAgent) || Boolean(window.Pi);
}

let loadPromise: Promise<boolean> | null = null;
export function waitForPiSdk(timeoutMs = 12000): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Pi) return Promise.resolve(true);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    const done = () => resolve(Boolean(window.Pi));
    if (existing) {
      existing.addEventListener("load", done, { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
    } else {
      const s = document.createElement("script");
      s.src = SDK_URL;
      s.async = true;
      s.onload = done;
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    }
    window.setTimeout(() => resolve(Boolean(window.Pi)), timeoutMs);
  });
  return loadPromise;
}

let initialized = false;
export function initPiSdk(): boolean {
  if (typeof window === "undefined" || !window.Pi) return false;
  if (initialized) return true;
  try {
    window.Pi.init({ version: "2.0", sandbox: isPiSandbox() });
    initialized = true;
    return true;
  } catch (e) {
    console.warn("Pi SDK init failed", e);
    return false;
  }
}

export function loadPiAuthSession(): PiAuthSession | null {
  try {
    const raw = localStorage.getItem(PI_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PiAuthSession;
    if (!parsed?.uid || !parsed?.accessToken) return null;
    return parsed;
  } catch { return null; }
}
export function savePiAuthSession(session: PiAuthSession): void { localStorage.setItem(PI_AUTH_STORAGE_KEY, JSON.stringify(session)); }
export function clearPiAuthSession(): void { localStorage.removeItem(PI_AUTH_STORAGE_KEY); }

export async function authenticatePi(scopes: string[] = ["username"]): Promise<PiAuthSession> {
  await waitForPiSdk();
  if (!window.Pi) throw new Error("Pi SDK unavailable. Open this app in Pi Browser.");
  initPiSdk();
  const auth = await window.Pi.authenticate(scopes, () => { /* ignored: A2U flow only */ });
  const session: PiAuthSession = { uid: auth.user.uid, username: auth.user.username || "", accessToken: auth.accessToken };
  savePiAuthSession(session);
  return session;
}