/** Client helpers for Sign in with Telegram (OIDC). Docs: https://core.telegram.org/bots/telegram-login */

export const TELEGRAM_BRAND_BLUE = "#229ED9";
export const TELEGRAM_AUTH_LOGO = "/auth-telegram.svg";

export async function startTelegramSignIn(opts?: { redirectTo?: string }): Promise<void> {
  if (typeof window === "undefined") return;

  const origin = encodeURIComponent(window.location.origin);
  const res = await fetch(`/api/public/telegram-auth?origin=${origin}`);
  const body = (await res.json().catch(() => ({}))) as {
    authorize_url?: string;
    state?: string;
    error?: string;
  };
  if (!res.ok || !body.authorize_url || !body.state) {
    throw new Error(body.error || `Could not start Telegram sign-in (${res.status})`);
  }

  sessionStorage.setItem("telegram_oauth_state", body.state);
  sessionStorage.setItem("telegram_oauth_redirect", opts?.redirectTo || "/dashboard");
  window.location.href = body.authorize_url;
}
