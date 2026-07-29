/** sessionStorage key — OpenPay OAuth connect callback redirects here after success. */
export const OPENPAY_CONNECT_RETURN_KEY = "openpay_connect_return";

export function stashOpenPayConnectReturn(path: string) {
  try {
    if (path.startsWith("/") && !path.startsWith("//")) {
      sessionStorage.setItem(OPENPAY_CONNECT_RETURN_KEY, path);
    }
  } catch {
    /* ignore */
  }
}

export function takeOpenPayConnectReturn(fallback = "/settings"): string {
  try {
    const raw = sessionStorage.getItem(OPENPAY_CONNECT_RETURN_KEY);
    sessionStorage.removeItem(OPENPAY_CONNECT_RETURN_KEY);
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}
