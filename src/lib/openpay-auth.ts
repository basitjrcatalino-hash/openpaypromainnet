/** Client helpers for Sign in with OpenPay (docs: https://openpy.space/openpay-auth). */

export const OPENPAY_BRAND_BLUE = "#1652f0";
export const OPENPAY_LOGO_WHITE = "https://openpy.space/openpay-o-white.svg";
/** Official full-color auth logo (per https://openpy.space/openpay-auth). */
export const OPENPAY_AUTH_LOGO = "https://openpy.space/openpay-auth-logo.png";
/** OpenPay AI assistant mascot (animated GIF). */
export const OPENPAY_AI_AVATAR =
  "https://i.ibb.co/FS3vY41/grok-video-9d6a8e79-086b-4e46-b1b0-e0852f6cefd02-ezgif-com-video-to-gif-converter.gif";
/** OpenPay AI sidebar / menu icon (static PNG, transparent bg). */
export const OPENPAY_AI_MENU_ICON =
  "https://i.ibb.co/CpdgyWt7/photo-2026-07-28-17-07-40-removebg-preview.png";
/** Partner portal — key management (Apps & keys). */
export const OPENPAY_PARTNER_PORTAL = "https://openpy.space/partner-api";

/** Canonical production host — OAuth callback + state HMAC must share this origin. */
export const OPENPAY_PRO_PUBLIC_ORIGIN = "https://openpaypro.space";

function isLocalDevHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
}

/**
 * Start Sign in with OpenPay.
 * On localhost, bootstrap from production so the OAuth `state` HMAC is signed by the
 * same server that handles `/auth/openpay/callback` (localhost is not an allowlisted redirect).
 */
export async function startOpenPaySignIn(opts?: { redirectTo?: string }): Promise<void> {
  if (typeof window === "undefined") return;

  const localOrigin = window.location.origin;
  const onLocal = isLocalDevHost(window.location.hostname);
  // Always ask production to mint state when local — callback lands on openpaypro.space.
  const apiBase = onLocal ? OPENPAY_PRO_PUBLIC_ORIGIN : "";
  const originParam = encodeURIComponent(onLocal ? OPENPAY_PRO_PUBLIC_ORIGIN : localOrigin);

  const res = await fetch(`${apiBase}/api/public/openpay-auth?origin=${originParam}`);
  const body = (await res.json().catch(() => ({}))) as {
    authorize_url?: string;
    state?: string;
    redirect_uri?: string;
    error?: string;
  };
  if (!res.ok || !body.authorize_url || !body.state) {
    const msg =
      typeof body.error === "string" &&
      body.error.trim() &&
      body.error !== "0" &&
      body.error !== "()"
        ? body.error
        : `Could not start OpenPay sign-in (${res.status || "network"})`;
    throw new Error(msg);
  }

  sessionStorage.setItem("openpay_oauth_state", body.state);
  sessionStorage.setItem("openpay_oauth_redirect", opts?.redirectTo || "/dashboard");
  // Remember we started from local so callback success can deep-link back if needed.
  if (onLocal) {
    sessionStorage.setItem("openpay_oauth_started_local", localOrigin);
  } else {
    sessionStorage.removeItem("openpay_oauth_started_local");
  }

  window.location.href = body.authorize_url;
}
