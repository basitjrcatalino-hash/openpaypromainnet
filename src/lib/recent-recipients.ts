const STORAGE_KEY = "openpay-recent-recipients";
const MAX = 8;

export type RecentRecipient = {
  address: string;
  label?: string;
  at: number;
};

export function loadRecentRecipients(): RecentRecipient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentRecipient[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function saveRecentRecipient(address: string, label?: string) {
  const trimmed = address.trim();
  if (!trimmed) return;
  const lower = trimmed.toLowerCase();
  const skip = ["opendex", "opentoken", "openpay"].some((s) => lower.includes(s));
  if (skip) return;
  try {
    const prev = loadRecentRecipients().filter((r) => r.address.toLowerCase() !== lower);
    const next: RecentRecipient[] = [{ address: trimmed, label, at: Date.now() }, ...prev].slice(
      0,
      MAX,
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function isSystemCounterparty(cp: string | null | undefined): boolean {
  if (!cp) return true;
  const lower = cp.toLowerCase();
  return (
    lower === "opendex" ||
    lower === "opentoken" ||
    lower.startsWith("opentoken:") ||
    lower.startsWith("openpay") ||
    lower.startsWith("pi:") ||
    lower.startsWith("voucher:") ||
    lower.startsWith("openpay-nft:")
  );
}
