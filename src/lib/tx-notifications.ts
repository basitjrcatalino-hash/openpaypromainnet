import type { Tables } from "@/integrations/supabase/types";
import { formatNumber } from "@/lib/wallet-utils";

export type TxRow = Tables<"transactions">;

export type AppNotification = {
  id: string;
  txId: string;
  title: string;
  body: string;
  type: string;
  tokenSymbol: string | null;
  amount: number;
  createdAt: string;
  read: boolean;
};

const storeKey = (userId: string) => `openpay_tx_notifications_${userId}`;
const seenKey = (userId: string) => `openpay_tx_seen_${userId}`;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadNotifications(userId: string): AppNotification[] {
  return readJson<AppNotification[]>(storeKey(userId), []);
}

export function saveNotifications(userId: string, items: AppNotification[]) {
  writeJson(storeKey(userId), items.slice(0, 100));
}

export function loadSeenTxIds(userId: string): Set<string> {
  return new Set(readJson<string[]>(seenKey(userId), []));
}

export function saveSeenTxIds(userId: string, ids: Set<string>) {
  writeJson(seenKey(userId), [...ids].slice(-200));
}

export function formatTxNotification(tx: TxRow): Omit<AppNotification, "id" | "read"> {
  const symbol = tx.token_symbol ?? "token";
  const amount = formatNumber(tx.amount, 4);
  const type = tx.type;
  const title =
    type === "receive" || type === "buy"
      ? `Received ${amount} ${symbol}`
      : type === "send" || type === "sell"
        ? `Sent ${amount} ${symbol}`
        : type === "swap"
          ? `Swapped ${amount} ${symbol}`
          : `${type} · ${amount} ${symbol}`;

  const body =
    tx.memo?.trim() ||
    (tx.counterparty ? `With ${tx.counterparty.slice(0, 18)}…` : `Status: ${tx.status}`);

  return {
    txId: tx.id,
    title,
    body,
    type: tx.type,
    tokenSymbol: tx.token_symbol,
    amount: Number(tx.amount),
    createdAt: tx.created_at,
  };
}

export function pushNotification(userId: string, tx: TxRow): AppNotification | null {
  const seen = loadSeenTxIds(userId);
  if (seen.has(tx.id)) return null;

  const note: AppNotification = {
    id: `n_${tx.id}`,
    ...formatTxNotification(tx),
    read: false,
  };

  const list = [note, ...loadNotifications(userId).filter((n) => n.txId !== tx.id)];
  saveNotifications(userId, list);
  seen.add(tx.id);
  saveSeenTxIds(userId, seen);
  return note;
}

export function markAllRead(userId: string): AppNotification[] {
  const list = loadNotifications(userId).map((n) => ({ ...n, read: true }));
  saveNotifications(userId, list);
  return list;
}

export function markRead(userId: string, id: string): AppNotification[] {
  const list = loadNotifications(userId).map((n) => (n.id === id ? { ...n, read: true } : n));
  saveNotifications(userId, list);
  return list;
}

export function clearNotifications(userId: string) {
  saveNotifications(userId, []);
}

export function unreadCount(items: AppNotification[]): number {
  return items.filter((n) => !n.read).length;
}

export async function ensureBrowserPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

export function showBrowserNotification(note: AppNotification) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(note.title, {
      body: note.body,
      tag: note.txId,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // ignore unsupported environments
  }
}
