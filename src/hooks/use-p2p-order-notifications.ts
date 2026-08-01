import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  ensureP2pSoundUnlockListeners,
  playP2pSound,
  type P2pSoundKind,
} from "@/lib/p2p-sounds";
import { ORDER_STATUS_LABEL } from "@/lib/p2p";

type PrefsNotifications = Record<string, unknown>;
type OrderRow = Tables<"p2p_orders">;

const SEEN_ORDERS_KEY = "p2p-seen-orders-v1";
const SEEN_MSGS_KEY = "p2p-seen-msgs-v1";

function p2pAlertsEnabled(prefs: PrefsNotifications | null | undefined): boolean {
  if (!prefs) return true;
  if (typeof prefs.p2p_alerts === "boolean") return prefs.p2p_alerts;
  return true;
}

function loadSeen(key: string, userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${key}:${userId}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr.slice(-200) : []);
  } catch {
    return new Set();
  }
}

function saveSeen(key: string, userId: string, set: Set<string>) {
  try {
    localStorage.setItem(`${key}:${userId}`, JSON.stringify([...set].slice(-200)));
  } catch {
    /* ignore */
  }
}

function soundForStatus(status: string): P2pSoundKind {
  if (status === "paid") return "paid";
  if (status === "disputed" || status === "cancelled" || status === "expired") return "alert";
  if (status === "completed") return "paid";
  return "order";
}

function titleForOrder(order: OrderRow, isSeller: boolean): string {
  if (order.status === "pending_payment" && isSeller) return "New P2P order";
  if (order.status === "paid" && isSeller) return "Buyer marked paid";
  if (order.status === "paid" && !isSeller) return "Waiting for seller";
  if (order.status === "completed") return "P2P trade completed";
  if (order.status === "disputed") return "P2P dispute opened";
  return `P2P · ${ORDER_STATUS_LABEL[order.status] ?? order.status}`;
}

/**
 * Realtime P2P order + message alerts with notification sounds.
 * Mount once for authenticated users (works outside /p2p too).
 */
export function useP2pOrderNotifications(userId: string) {
  const qc = useQueryClient();
  const readyRef = useRef(false);
  const seenOrders = useRef<Set<string>>(new Set());
  const seenMsgs = useRef<Set<string>>(new Set());
  const orderFingerprint = useRef<Map<string, string>>(new Map());

  const { data: prefs } = useQuery({
    queryKey: ["prefs", userId],
    queryFn: async () =>
      (
        await supabase
          .from("user_preferences")
          .select("notifications")
          .eq("user_id", userId)
          .maybeSingle()
      ).data,
    staleTime: 30_000,
  });

  const notifPrefs = (prefs?.notifications as PrefsNotifications | null) ?? null;
  const alertsOn = p2pAlertsEnabled(notifPrefs);

  const notifyOrder = useCallback(
    (order: OrderRow, opts?: { forceSound?: boolean }) => {
      if (!alertsOn) return;
      const isSeller = order.seller_id === userId;
      const isBuyer = order.buyer_id === userId;
      if (!isSeller && !isBuyer) return;

      const fp = `${order.status}|${order.escrow_status}|${order.updated_at}`;
      const prev = orderFingerprint.current.get(order.id);
      const isNew = !seenOrders.current.has(order.id);
      const statusChanged = prev != null && prev !== fp;

      if (!isNew && !statusChanged && !opts?.forceSound) return;

      seenOrders.current.add(order.id);
      orderFingerprint.current.set(order.id, fp);
      saveSeen(SEEN_ORDERS_KEY, userId, seenOrders.current);

      // Skip noisy first seed after page load
      if (!readyRef.current) return;

      const kind = isNew ? "order" : soundForStatus(order.status);
      playP2pSound(kind);
      toast(titleForOrder(order, isSeller), {
        id: `p2p-order-${order.id}-${order.status}`,
        description: `${order.ref} · ${Number(order.amount)} ${order.asset}`,
        duration: 5600,
        action: {
          label: "Open",
          onClick: () => {
            window.location.assign(`/p2p/order/${order.id}`);
          },
        },
      });

      void qc.invalidateQueries({ queryKey: ["p2p-orders"] });
      void qc.invalidateQueries({ queryKey: ["p2p-order", order.id] });
      void qc.invalidateQueries({ queryKey: ["p2p-ads"] });
      void qc.invalidateQueries({ queryKey: ["p2p-inbox"] });
      void qc.invalidateQueries({ queryKey: ["p2p-inbox-unread"] });
    },
    [alertsOn, qc, userId],
  );

  const notifyMessage = useCallback(
    (msg: { id: string; order_id: string; sender_id: string | null; is_system: boolean; body: string | null }) => {
      if (!alertsOn) return;
      if (msg.is_system) return;
      if (msg.sender_id === userId) return;
      if (seenMsgs.current.has(msg.id)) return;
      seenMsgs.current.add(msg.id);
      saveSeen(SEEN_MSGS_KEY, userId, seenMsgs.current);
      if (!readyRef.current) return;

      playP2pSound("message");
      toast("P2P message", {
        id: `p2p-msg-${msg.id}`,
        description: (msg.body || "New message").slice(0, 80),
        duration: 5600,
        action: {
          label: "Open",
          onClick: () => {
            window.location.assign(`/p2p/order/${msg.order_id}`);
          },
        },
      });
      void qc.invalidateQueries({ queryKey: ["p2p-msgs", msg.order_id] });
      void qc.invalidateQueries({ queryKey: ["p2p-inbox"] });
      void qc.invalidateQueries({ queryKey: ["p2p-inbox-unread"] });
    },
    [alertsOn, qc, userId],
  );

  useEffect(() => {
    ensureP2pSoundUnlockListeners();
    seenOrders.current = loadSeen(SEEN_ORDERS_KEY, userId);
    seenMsgs.current = loadSeen(SEEN_MSGS_KEY, userId);
    readyRef.current = false;

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("p2p_orders")
        .select("id,status,escrow_status,updated_at")
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order("updated_at", { ascending: false })
        .limit(80);
      if (cancelled) return;
      for (const o of data ?? []) {
        seenOrders.current.add(o.id);
        orderFingerprint.current.set(
          o.id,
          `${o.status}|${o.escrow_status}|${o.updated_at}`,
        );
      }
      saveSeen(SEEN_ORDERS_KEY, userId, seenOrders.current);
      // Allow sounds shortly after seed
      window.setTimeout(() => {
        if (!cancelled) readyRef.current = true;
      }, 1500);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`p2p-notify-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "p2p_orders",
          filter: `seller_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const row = payload.new as OrderRow | null;
          if (row?.id) notifyOrder(row);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "p2p_orders",
          filter: `buyer_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const row = payload.new as OrderRow | null;
          if (row?.id) notifyOrder(row);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "p2p_messages",
        },
        async (payload) => {
          const msg = payload.new as {
            id: string;
            order_id: string;
            sender_id: string | null;
            is_system: boolean;
            body: string | null;
          };
          if (!msg?.order_id) return;
          // Confirm this message belongs to one of the user's orders
          const { data: order } = await supabase
            .from("p2p_orders")
            .select("id")
            .eq("id", msg.order_id)
            .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
            .maybeSingle();
          if (order) notifyMessage(msg);
        },
      )
      .subscribe();

    // Polling fallback when realtime is delayed
    const poll = window.setInterval(async () => {
      if (!alertsOn) return;
      const { data } = await supabase
        .from("p2p_orders")
        .select("*")
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order("updated_at", { ascending: false })
        .limit(20);
      for (const o of data ?? []) notifyOrder(o);
    }, 20_000);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [userId, alertsOn, notifyOrder, notifyMessage]);
}
