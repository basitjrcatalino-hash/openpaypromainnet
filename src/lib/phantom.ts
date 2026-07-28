/** Phantom Portal App ID (client-safe). */
export const PHANTOM_APP_ID =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_PHANTOM_APP_ID ?? "").trim()) ||
  "42ba7350-53ef-4b1e-aba6-43f7905b094e";

/**
 * Optional explicit redirect override (must be allowlisted in Phantom Portal).
 * Prefer leaving unset so the SDK uses the current origin + /auth/callback.
 */
export const PHANTOM_REDIRECT_URL_ENV =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_PHANTOM_REDIRECT_URL ?? "").trim()) ||
  "";

/** @deprecated Use getPhantomRedirectUrl() — kept for docs/fallback. */
export const PHANTOM_REDIRECT_URL =
  PHANTOM_REDIRECT_URL_ENV || "https://openpaypro.space/auth/callback";

export const PHANTOM_APP_NAME = "OpenPay Pro";

export const PHANTOM_APP_ICON =
  "https://phantom-portal20240925173430423400000001.s3.ca-central-1.amazonaws.com/icons/2e2b40dc-1916-4d04-8e1d-bdc7c20f63a5.jpg";

export const PHANTOM_PROVIDERS = ["google", "apple", "injected"] as const;

/** Keep as plain strings so this module never pulls @phantom/react-sdk (Buffer crash). */
export const PHANTOM_ADDRESS_TYPES = ["solana", "ethereum", "sui"] as const;

export const PHANTOM_OAUTH_PENDING_KEY = "phantom_oauth_pending";
export const PHANTOM_OAUTH_CALLBACK_URL_KEY = "phantom_oauth_callback_url";

/**
 * Redirect after Google/Apple OAuth. Must exactly match a Phantom Portal Redirect URL
 * and the Allowed Origin must include this page's origin.
 * Docs: https://docs.phantom.com/phantom-portal/configure-urls
 */
export function getPhantomRedirectUrl(): string {
  if (PHANTOM_REDIRECT_URL_ENV) {
    return PHANTOM_REDIRECT_URL_ENV.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }
  return PHANTOM_REDIRECT_URL.replace(/\/$/, "");
}

export function getPhantomProviderConfig() {
  return {
    providers: [...PHANTOM_PROVIDERS],
    appId: PHANTOM_APP_ID,
    addressTypes: [...PHANTOM_ADDRESS_TYPES],
    authOptions: {
      redirectUrl: getPhantomRedirectUrl(),
    },
  };
}

/** Origins / redirects to allowlist in Phantom Portal for this project. */
export const PHANTOM_PORTAL_ALLOWLIST_HINTS = [
  "https://openpaypro.space",
  "https://openpaypro.space/auth/callback",
  "https://openpaypromainnet.lovable.app",
  "https://openpaypromainnet.lovable.app/auth/callback",
  "https://openpaypromainnet.vercel.app",
  "https://openpaypromainnet.vercel.app/auth/callback",
] as const;

/**
 * Phantom OAuth stores state in sessionStorage on the current origin.
 * If auth starts inside an iframe (Lovable preview) but callback lands on top
 * window, state is missing → "Missing expected OAuth state".
 */
export function ensureTopLevelAuthWindow(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.self === window.top) return true;
    const href = window.location.href;
    if (window.top) {
      window.top.location.href = href;
      return false;
    }
  } catch {
    // Cross-origin iframe: open top-level copy
    try {
      window.open(window.location.href, "_top");
    } catch {
      /* ignore */
    }
    return false;
  }
  return true;
}

export function markPhantomOAuthPending(): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    at: Date.now(),
    origin: window.location.origin,
    redirectUrl: getPhantomRedirectUrl(),
  });
  try {
    sessionStorage.setItem(PHANTOM_OAUTH_PENDING_KEY, payload);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(PHANTOM_OAUTH_PENDING_KEY, payload);
  } catch {
    /* ignore */
  }
}

export function clearPhantomOAuthPending(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PHANTOM_OAUTH_PENDING_KEY);
    sessionStorage.removeItem(PHANTOM_OAUTH_CALLBACK_URL_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(PHANTOM_OAUTH_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function snapshotPhantomCallbackUrl(): void {
  if (typeof window === "undefined") return;
  const href = window.location.href;
  if (!/[?&#](code|state|authorization_code)=/i.test(href)) return;
  try {
    sessionStorage.setItem(PHANTOM_OAUTH_CALLBACK_URL_KEY, href);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(PHANTOM_OAUTH_CALLBACK_URL_KEY, href);
  } catch {
    /* ignore */
  }
}

export function hasPhantomOAuthCallbackParams(href = typeof window !== "undefined" ? window.location.href : ""): boolean {
  return /[?&#](code|state|authorization_code)=/i.test(href);
}

export function readPhantomOAuthPending(): { at: number; origin: string; redirectUrl: string } | null {
  if (typeof window === "undefined") return null;
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(PHANTOM_OAUTH_PENDING_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { at?: number; origin?: string; redirectUrl?: string };
      if (parsed?.origin) {
        return {
          at: Number(parsed.at) || 0,
          origin: parsed.origin,
          redirectUrl: parsed.redirectUrl || "",
        };
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}
