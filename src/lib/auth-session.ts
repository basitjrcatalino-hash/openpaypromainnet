/**
 * Remembers that the person chose to sign out on this device, so the sign-in
 * page waits for them to tap a sign-in option instead of silently signing
 * them straight back in (e.g. Pi Browser auto sign-in).
 */
const KEY = "op_signed_out";

export function markSignedOut() {
  try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
}

export function clearSignedOut() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function wasSignedOut(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

/** Rejects if `promise` does not settle within `ms` (prevents endless spinners). */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
