/** App lock password — Phantom-style unlock for OpenPay Pro. */

/** In-memory only: survives SPA navigations, clears on full page reload. */
const unlockedUsers = new Set<string>();

const LOCK_ENABLED_KEY = (userId: string) => `openpay-pro-lock-enabled:${userId}`;

export async function hashLockPassword(userId: string, password: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${userId}:${password}`),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isSessionUnlocked(userId: string): boolean {
  return unlockedUsers.has(userId);
}

export function markSessionUnlocked(userId: string) {
  unlockedUsers.add(userId);
}

export function clearSessionUnlock(userId: string) {
  unlockedUsers.delete(userId);
}

/** Prefer remote pin flag; local flag is a UX hint after set. */
export function rememberLockEnabled(userId: string, enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(LOCK_ENABLED_KEY(userId), "1");
    else localStorage.removeItem(LOCK_ENABLED_KEY(userId));
  } catch {
    /* ignore */
  }
}

export function isLockEnabledLocally(userId: string): boolean {
  try {
    return localStorage.getItem(LOCK_ENABLED_KEY(userId)) === "1";
  } catch {
    return false;
  }
}

export function validateLockPassword(password: string): string | null {
  const p = password.trim();
  if (p.length < 6) return "Password must be at least 6 characters";
  if (p.length > 128) return "Password is too long";
  return null;
}
