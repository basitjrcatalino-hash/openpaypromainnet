import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type P2PAd = Tables<"p2p_ads">;
export type P2POrder = Tables<"p2p_orders">;
export type P2PMessage = Tables<"p2p_messages">;
export type P2PDispute = Tables<"p2p_disputes">;
export type P2PPaymentMethod = Tables<"p2p_payment_methods">;

export const P2P_ASSETS = ["OUSD", "USDT", "USDC", "ETH", "BTC", "SOL"] as const;
export type P2PAsset = (typeof P2P_ASSETS)[number];

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: "Pending payment",
  paid: "Waiting for seller",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  disputed: "Disputed",
};

export const ESCROW_LABEL: Record<string, string> = {
  none: "No escrow",
  locked: "Escrow locked",
  released: "Escrow released",
  refunded: "Escrow refunded",
  frozen: "Escrow frozen",
};

export function statusTone(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/12 text-emerald-500 border-emerald-500/25";
    case "paid":
      return "bg-amber-500/12 text-amber-500 border-amber-500/25";
    case "disputed":
      return "bg-rose-500/12 text-rose-500 border-rose-500/25";
    case "cancelled":
    case "expired":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-primary/12 text-primary border-primary/25";
  }
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function fmtAmount(v: number | string | null | undefined, digits = 2): string {
  const n = Number(v ?? 0);
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: 8 });
}

/* ------------------------------- queries -------------------------------- */

export async function fetchPaymentMethods(): Promise<P2PPaymentMethod[]> {
  const { data, error } = await supabase
    .from("p2p_payment_methods")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAds(opts: { side: "sell" | "buy"; asset: string }): Promise<P2PAd[]> {
  const { data, error } = await supabase
    .from("p2p_ads")
    .select("*")
    .eq("status", "active")
    .eq("side", opts.side)
    .eq("asset", opts.asset)
    .gt("available_amount", 0)
    .order("price_usd", { ascending: opts.side === "sell" })
    .limit(60);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchMyAds(userId: string): Promise<P2PAd[]> {
  const { data, error } = await supabase
    .from("p2p_ads")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchMyOrders(userId: string): Promise<P2POrder[]> {
  const { data, error } = await supabase
    .from("p2p_orders")
    .select("*")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchOrder(id: string): Promise<P2POrder | null> {
  const { data, error } = await supabase.from("p2p_orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchMessages(orderId: string): Promise<P2PMessage[]> {
  const { data, error } = await supabase
    .from("p2p_messages")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchDispute(orderId: string): Promise<P2PDispute | null> {
  const { data, error } = await supabase
    .from("p2p_disputes")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchDisplayNames(ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return {};
  const { data, error } = await supabase.rpc("p2p_display_names", { _ids: unique });
  if (error) return {};
  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.id] = row.name ?? "Trader";
  return map;
}

/* ------------------------------- actions -------------------------------- */

export async function createAd(input: {
  side: "sell" | "buy";
  asset: string;
  priceUsd: number;
  totalAmount: number;
  minOrder: number;
  maxOrder: number;
  paymentMethods: string[];
  payTimeLimitMinutes: number;
  terms?: string | null;
}) {
  const { data, error } = await supabase.rpc("p2p_create_ad", {
    _side: input.side,
    _asset: input.asset,
    _price_usd: input.priceUsd,
    _total_amount: input.totalAmount,
    _min_order: input.minOrder,
    _max_order: input.maxOrder,
    _payment_methods: input.paymentMethods,
    _pay_time_limit_minutes: input.payTimeLimitMinutes,
    _terms: input.terms ?? undefined,
  });
  if (!error) return data as unknown as P2PAd;

  // Fallback while migration is rolling out (or RPC not yet deployed).
  const missingFn = /p2p_create_ad|schema cache|does not exist/i.test(error.message);
  if (!missingFn) throw new Error(error.message);

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data: inserted, error: insertError } = await supabase
    .from("p2p_ads")
    .insert({
      user_id: uid,
      side: input.side,
      asset: input.asset,
      price_usd: input.priceUsd,
      total_amount: input.totalAmount,
      available_amount: input.totalAmount,
      min_order: input.minOrder,
      max_order: input.maxOrder,
      payment_methods: input.paymentMethods,
      pay_time_limit_minutes: input.payTimeLimitMinutes,
      terms: input.terms ?? null,
    })
    .select("*")
    .single();
  if (insertError) throw new Error(insertError.message);
  return inserted;
}

export async function openOrder(adId: string, amount: number, paymentMethod: string) {
  const { data, error } = await supabase.rpc("p2p_open_order", {
    _ad_id: adId,
    _amount: amount,
    _payment_method: paymentMethod,
  });
  if (error) throw new Error(error.message);
  return data as unknown as P2POrder;
}

export async function markPaid(orderId: string, proofUrl?: string | null) {
  const { error } = await supabase.rpc("p2p_mark_paid", {
    _order_id: orderId,
    _proof_url: proofUrl ?? undefined,
  });
  if (error) throw new Error(error.message);
}

export async function confirmReceived(orderId: string) {
  const { error } = await supabase.rpc("p2p_confirm_received", { _order_id: orderId });
  if (error) throw new Error(error.message);
}

export async function cancelOrder(orderId: string, reason?: string) {
  const { error } = await supabase.rpc("p2p_cancel_order", {
    _order_id: orderId,
    _reason: reason ?? undefined,
  });
  if (error) throw new Error(error.message);
}

export async function openDispute(orderId: string, reason: string) {
  const { error } = await supabase.rpc("p2p_open_dispute", { _order_id: orderId, _reason: reason });
  if (error) throw new Error(error.message);
}

export async function resolveDispute(orderId: string, releaseToBuyer: boolean, resolution: string) {
  const { error } = await supabase.rpc("p2p_resolve_dispute", {
    _order_id: orderId,
    _release_to_buyer: releaseToBuyer,
    _resolution: resolution,
  });
  if (error) throw new Error(error.message);
}

export async function expireOrders() {
  const { error } = await supabase.rpc("p2p_expire_orders");
  if (error) throw new Error(error.message);
}

export async function sendMessage(orderId: string, senderId: string, body: string) {
  const { error } = await supabase
    .from("p2p_messages")
    .insert({ order_id: orderId, sender_id: senderId, body });
  if (error) throw new Error(error.message);
}

/* ------------------------------- OKX hub helpers ------------------------ */

export type P2PTraderStats = {
  id: string;
  completed_count: number;
  completion_rate: number | null;
  avg_pay_seconds: number | null;
  last_active_at: string | null;
};

export type P2PInboxThread = {
  order: P2POrder;
  lastMessage: P2PMessage | null;
  counterpartyId: string;
};

export async function fetchTraderStats(ids: string[]): Promise<Record<string, P2PTraderStats>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return {};
  const { data, error } = await supabase.rpc("p2p_trader_stats", { _ids: unique });
  if (error) {
    // Graceful fallback before migration is applied.
    return Object.fromEntries(
      unique.map((id) => [
        id,
        {
          id,
          completed_count: 0,
          completion_rate: null,
          avg_pay_seconds: null,
          last_active_at: null,
        } satisfies P2PTraderStats,
      ]),
    );
  }
  const map: Record<string, P2PTraderStats> = {};
  for (const row of data ?? []) {
    map[row.id] = {
      id: row.id,
      completed_count: Number(row.completed_count ?? 0),
      completion_rate: row.completion_rate == null ? null : Number(row.completion_rate),
      avg_pay_seconds: row.avg_pay_seconds == null ? null : Number(row.avg_pay_seconds),
      last_active_at: row.last_active_at ?? null,
    };
  }
  return map;
}

export function isTraderOnline(lastActiveAt: string | null | undefined, withinMs = 15 * 60_000) {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() <= withinMs;
}

export async function fetchLockedEscrow(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("p2p_orders")
    .select("asset, amount")
    .eq("seller_id", userId)
    .eq("escrow_status", "locked");
  if (error) throw new Error(error.message);
  const locked: Record<string, number> = {};
  for (const row of data ?? []) {
    const asset = String(row.asset).toUpperCase();
    locked[asset] = (locked[asset] ?? 0) + Number(row.amount ?? 0);
  }
  return locked;
}

export async function fetchInboxThreads(userId: string): Promise<P2PInboxThread[]> {
  const orders = await fetchMyOrders(userId);
  if (!orders.length) return [];
  const ids = orders.map((o) => o.id);
  const { data: msgs, error } = await supabase
    .from("p2p_messages")
    .select("*")
    .in("order_id", ids)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const latestByOrder = new Map<string, P2PMessage>();
  for (const m of msgs ?? []) {
    if (!latestByOrder.has(m.order_id)) latestByOrder.set(m.order_id, m);
  }

  return orders
    .map((order) => ({
      order,
      lastMessage: latestByOrder.get(order.id) ?? null,
      counterpartyId: order.buyer_id === userId ? order.seller_id : order.buyer_id,
    }))
    .sort((a, b) => {
      const at = a.lastMessage?.created_at ?? a.order.updated_at ?? a.order.created_at;
      const bt = b.lastMessage?.created_at ?? b.order.updated_at ?? b.order.created_at;
      return new Date(bt).getTime() - new Date(at).getTime();
    });
}

/** Approximate unread: non-system messages from counterparty on open orders. */
export async function fetchInboxUnreadCount(userId: string): Promise<number> {
  const orders = await fetchMyOrders(userId);
  const open = orders.filter((o) =>
    ["pending_payment", "paid", "disputed"].includes(o.status),
  );
  if (!open.length) return 0;
  const ids = open.map((o) => o.id);
  const { data, error } = await supabase
    .from("p2p_messages")
    .select("order_id, sender_id, is_system")
    .in("order_id", ids)
    .eq("is_system", false)
    .neq("sender_id", userId);
  if (error) return 0;
  const seen = new Set<string>();
  for (const m of data ?? []) {
    if (m.order_id) seen.add(m.order_id);
  }
  return seen.size;
}

export function matchExpressAd(
  ads: P2PAd[],
  opts: { amount: number; paymentMethod?: string | null },
): P2PAd | null {
  const amt = opts.amount;
  if (!(amt > 0)) return null;
  const filtered = ads.filter((ad) => {
    const available = Number(ad.available_amount);
    const min = Number(ad.min_order);
    const max = Number(ad.max_order);
    if (amt > available || amt < min || amt > max) return false;
    if (opts.paymentMethod && !ad.payment_methods.includes(opts.paymentMethod)) return false;
    return true;
  });
  return filtered[0] ?? null;
}

export function formatAvgPayTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "N/A";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m <= 0) return `${s}s`;
  return `${m}m ${s}s`;
}

