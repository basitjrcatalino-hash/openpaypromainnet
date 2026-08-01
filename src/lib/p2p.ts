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
