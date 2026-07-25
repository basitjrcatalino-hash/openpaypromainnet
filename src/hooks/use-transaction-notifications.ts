import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  clearNotifications,
  loadNotifications,
  markAllRead,
  markRead,
  pushNotification,
  showBrowserNotification,
  type AppNotification,
} from "@/lib/tx-notifications";

type TxRow = Tables<"transactions">;
type PrefsNotifications = Record<string, unknown>;

function txAlertsEnabled(prefs: PrefsNotifications | null | undefined): boolean {
  if (!prefs) return true;
  if (typeof prefs.tx_alerts === "boolean") return prefs.tx_alerts;
  return true;
}

function browserPushEnabled(prefs: PrefsNotifications | null | undefined): boolean {
  if (!prefs) return false;
  return prefs.browser_push === true;
}

export function useTransactionNotifications(userId: string) {
  const qc = useQueryClient();
  const [items, setItems] = useState<AppNotification[]>(() => loadNotifications(userId));

  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets", userId],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("id").eq("user_id", userId);
      return data ?? [];
    },
    staleTime: 30_000,
  });

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
  const alertsOn = txAlertsEnabled(notifPrefs);
  const pushOn = browserPushEnabled(notifPrefs);
  const walletIds = useMemo(() => wallets.map((w) => w.id), [wallets]);

  const refresh = useCallback(() => {
    setItems(loadNotifications(userId));
  }, [userId]);

  const handleTx = useCallback(
    (tx: TxRow, opts?: { silent?: boolean }) => {
      if (!alertsOn) return;
      const note = pushNotification(userId, tx);
      if (!note) return;
      setItems(loadNotifications(userId));

      const ageMs = Date.now() - new Date(tx.created_at).getTime();
      const likelyLocalAction =
        ageMs >= 0 &&
        ageMs < 8_000 &&
        (tx.type === "send" || tx.type === "sell" || tx.type === "swap");

      if (!opts?.silent && !likelyLocalAction) {
        toast(note.title, { id: `tx-${note.txId}`, description: note.body });
      }
      if (pushOn) showBrowserNotification(note);
      void qc.invalidateQueries({ queryKey: ["recent-txs"] });
      void qc.invalidateQueries({ queryKey: ["all-txs"] });
      void qc.invalidateQueries({ queryKey: ["active-wallet", userId] });
      void qc.invalidateQueries({ queryKey: ["wallets", userId] });
      void qc.invalidateQueries({ queryKey: ["ousd-txs"] });
    },
    [alertsOn, pushOn, qc, userId],
  );

  // Seed seen set from recent txs so we don't spam on first load
  useEffect(() => {
    if (!walletIds.length) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id")
        .in("wallet_id", walletIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled || !data) return;
      const { loadSeenTxIds, saveSeenTxIds } = await import("@/lib/tx-notifications");
      const seen = loadSeenTxIds(userId);
      for (const row of data) seen.add(row.id);
      saveSeenTxIds(userId, seen);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, walletIds]);

  // Realtime: notify on every new transaction for this user's wallets
  useEffect(() => {
    if (!walletIds.length || !alertsOn) return;

    const channel = supabase
      .channel(`tx-notify-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        (payload) => {
          const tx = payload.new as TxRow;
          if (!tx?.id || !tx.wallet_id) return;
          if (!walletIds.includes(tx.wallet_id)) return;
          handleTx(tx);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [alertsOn, handleTx, userId, walletIds]);

  // Fallback poll in case realtime is delayed / unavailable
  useEffect(() => {
    if (!walletIds.length || !alertsOn) return;
    const tick = async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .in("wallet_id", walletIds)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!data?.length) return;
      for (const tx of [...data].reverse()) {
        handleTx(tx as TxRow, { silent: false });
      }
    };
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, [alertsOn, handleTx, walletIds]);

  useEffect(() => {
    refresh();
  }, [refresh, userId]);

  return {
    items,
    unread: items.filter((n) => !n.read).length,
    alertsOn,
    pushOn,
    refresh,
    markOneRead: (id: string) => setItems(markRead(userId, id)),
    markAll: () => setItems(markAllRead(userId)),
    clearAll: () => {
      clearNotifications(userId);
      setItems([]);
    },
  };
}
