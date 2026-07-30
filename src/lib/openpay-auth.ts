/** Client helpers for Sign in with OpenPay (docs: https://openpy.space/openpay-auth). */

export const OPENPAY_BRAND_BLUE = "#1652f0";
export const OPENPAY_LOGO_WHITE = "https://openpy.space/openpay-o-white.svg";
/** Official full-color auth logo (per https://openpy.space/openpay-auth). */
export const OPENPAY_AUTH_LOGO = "https://openpy.space/openpay-auth-logo.png";
/** Partner portal — key management (Apps & keys). */
export const OPENPAY_PARTNER_PORTAL = "https://openpy.space/partner-api";

export async function startOpenPaySignIn(opts?: { redirectTo?: string }): Promise<void> {
  if (typeof window === "undefined") return;

  const origin = encodeURIComponent(window.location.origin);
  const res = await fetch(`/api/public/openpay-auth?origin=${origin}`);
  const body = (await res.json().catch(() => ({}))) as {
    authorize_url?: string;
    state?: string;
    error?: string;
  };
  if (!res.ok || !body.authorize_url || !body.state) {
    throw new Error(body.error || `Could not start OpenPay sign-in (${res.status})`);
  }

  sessionStorage.setItem("openpay_oauth_state", body.state);
  sessionStorage.setItem("openpay_oauth_redirect", opts?.redirectTo || "/dashboard");
  window.location.href = body.authorize_url;
}
