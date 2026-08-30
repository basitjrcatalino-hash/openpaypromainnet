/** Pi Network Sign-In (OAuth2 implicit flow). */
export const PI_CLIENT_ID =
  (import.meta.env.VITE_PI_CLIENT_ID as string | undefined) ||
  "ircL9qSv8vk8iSpa27iEZ-KIx02v-DTIXgpTNIfksjI";

export const PI_AUTHORIZE_URL = "https://api.minepi.com/oauth2/authorize";

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function piRedirectUri(): string {
  return `${window.location.origin}/auth/pi/callback`;
}

/** Redirects the browser to Pi's consent screen. */
export function startPiSignIn(opts?: { redirectTo?: string }): void {
  const state = randomState();
  try {
    sessionStorage.setItem("pi_oauth_state", state);
    if (opts?.redirectTo?.startsWith("/")) {
      sessionStorage.setItem("post_auth_redirect", opts.redirectTo);
    }
  } catch {
    /* ignore */
  }
  const url = new URL(PI_AUTHORIZE_URL);
  url.searchParams.set("client_id", PI_CLIENT_ID);
  url.searchParams.set("redirect_uri", piRedirectUri());
  url.searchParams.set("response_type", "token");
  url.searchParams.set("scope", "username payments");
  url.searchParams.set("state", state);
  window.location.assign(url.toString());
}
