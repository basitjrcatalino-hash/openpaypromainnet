import { supabase } from "@/integrations/supabase/client";

/**
 * Client helpers — register service worker + Web Push subscription (lock screen).
 */

const VAPID_PUBLIC =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() || "";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (err) {
    console.warn("[push] SW register failed", err);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token
    ? { "content-type": "application/json", Authorization: `Bearer ${token}` }
    : { "content-type": "application/json" };
}

export async function subscribeWebPush(): Promise<PushSubscription | null> {
  if (!pushSupported() || !VAPID_PUBLIC) return null;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;

  const reg = await registerPushServiceWorker();
  if (!reg) return null;
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
  });
}

export async function syncPushSubscription(
  enabled: boolean,
): Promise<"ok" | "denied" | "unsupported" | "error"> {
  if (!pushSupported() || !VAPID_PUBLIC) return "unsupported";
  try {
    const headers = await authHeaders();
    if (!enabled) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/public/push/unsubscribe", {
          method: "POST",
          headers,
          body: JSON.stringify({ endpoint: sub.endpoint }),
          credentials: "include",
        });
        await sub.unsubscribe();
      }
      return "ok";
    }

    const sub = await subscribeWebPush();
    if (!sub) {
      return Notification.permission === "denied" ? "denied" : "error";
    }
    const json = sub.toJSON();
    const res = await fetch("/api/public/push/subscribe", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
      }),
    });
    if (!res.ok) return "error";
    return "ok";
  } catch (err) {
    console.warn("[push] sync failed", err);
    return "error";
  }
}
