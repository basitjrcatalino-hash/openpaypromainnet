import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { P2P_PAYMENT_METHOD_CATALOG } from "@/lib/p2p-payment-methods";

export type P2PAd = Tables<"p2p_ads">;
export type P2POrder = Tables<"p2p_orders">;
export type P2PMessage = Tables<"p2p_messages">;
export type P2PDispute = Tables<"p2p_disputes">;
export type P2PPaymentMethod = Tables<"p2p_payment_methods"> & {
  region?: string | null;
  keywords?: string | null;
};
export type P2PPaymentAccount = Tables<"p2p_payment_accounts">;

export type P2PPaymentAccountSnapshot = {
  account_id?: string;
  method_code: string;
  account_name: string;
  account_number: string;
  bank_name?: string | null;
  extra?: Record<string, unknown>;
};

export function parsePaymentSnapshot(raw: unknown): P2PPaymentAccountSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.account_name !== "string" || typeof o.account_number !== "string") return null;
  return {
    account_id: typeof o.account_id === "string" ? o.account_id : undefined,
    method_code: typeof o.method_code === "string" ? o.method_code : "",
    account_name: o.account_name,
    account_number: o.account_number,
    bank_name: typeof o.bank_name === "string" ? o.bank_name : null,
    extra: (o.extra && typeof o.extra === "object" ? o.extra : {}) as Record<string, unknown>,
  };
}

export const P2P_ASSETS = ["OUSD", "USDT", "USDC", "ETH", "BTC", "SOL"] as const;
export type P2PAsset = (typeof P2P_ASSETS)[number];

/** Hard cap per P2P ad total / order (OUSD units, or $ notional for other assets). */
export const P2P_MAX_AMOUNT_OUSD = 5000;

export function p2pAmountExceedsLimit(
  asset: string,
  amount: number,
  priceUsd = 1,
): boolean {
  if (!(amount > 0) || !(priceUsd > 0)) return true;
  const a = asset.toUpperCase();
  if (a === "OUSD" || a === "USDT" || a === "USDC") {
    return amount > P2P_MAX_AMOUNT_OUSD + 1e-12;
  }
  return amount * priceUsd > P2P_MAX_AMOUNT_OUSD + 1e-12;
}

export function p2pLimitError(asset: string): string {
  const a = asset.toUpperCase();
  if (a === "OUSD" || a === "USDT" || a === "USDC") {
    return `P2P limit is ${P2P_MAX_AMOUNT_OUSD.toLocaleString()} ${a} per ad/order`;
  }
  return `P2P limit is $${P2P_MAX_AMOUNT_OUSD.toLocaleString()} notional (~${P2P_MAX_AMOUNT_OUSD.toLocaleString()} OUSD) per ad/order`;
}

export function assertP2pAmountLimit(asset: string, amount: number, priceUsd = 1) {
  if (p2pAmountExceedsLimit(asset, amount, priceUsd)) {
    throw new Error(p2pLimitError(asset));
  }
}

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

  const byCode = new Map<string, P2PPaymentMethod>();
  const now = new Date().toISOString();

  for (const seed of P2P_PAYMENT_METHOD_CATALOG) {
    byCode.set(seed.code, {
      id: `catalog-${seed.code}`,
      code: seed.code,
      name: seed.name,
      icon: seed.icon,
      is_active: true,
      sort_order: seed.sort_order,
      region: seed.region,
      keywords: seed.keywords,
      created_at: now,
      updated_at: now,
    });
  }

  for (const row of data ?? []) {
    const prev = byCode.get(row.code);
    const rowName = typeof row.name === "string" ? row.name.trim() : "";
    byCode.set(row.code, {
      ...prev,
      ...row,
      name: rowName || prev?.name || row.code,
      region:
        (row as { region?: string | null }).region ?? prev?.region ?? "Global",
      keywords:
        (row as { keywords?: string | null }).keywords ?? prev?.keywords ?? "",
    });
  }

  return [...byCode.values()].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
  );
}

export async function fetchMyPaymentAccounts(userId: string): Promise<P2PPaymentAccount[]> {
  const { data, error } = await supabase
    .from("p2p_payment_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertPaymentAccount(input: {
  id?: string;
  methodCode: string;
  accountName: string;
  accountNumber: string;
  bankName?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");

  const payload = {
    user_id: uid,
    method_code: input.methodCode,
    account_name: input.accountName.trim(),
    account_number: input.accountNumber.trim(),
    bank_name: input.bankName?.trim() || null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("p2p_payment_accounts")
      .update(payload)
      .eq("id", input.id)
      .eq("user_id", uid)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as P2PPaymentAccount;
  }

  const { data, error } = await supabase
    .from("p2p_payment_accounts")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as P2PPaymentAccount;
}

export async function setPaymentAccountActive(id: string, isActive: boolean) {
  const { error } = await supabase
    .from("p2p_payment_accounts")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
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
  assertP2pAmountLimit(input.asset, input.totalAmount, input.priceUsd);
  assertP2pAmountLimit(input.asset, input.maxOrder, input.priceUsd);
  assertP2pAmountLimit(input.asset, input.minOrder, input.priceUsd);

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

  // Do not fall back to raw insert — merchant approval + limits live in the RPC.
  throw new Error(error.message);
}

export async function openOrder(adId: string, amount: number, paymentMethod: string) {
  const { data: adRow } = await supabase
    .from("p2p_ads")
    .select("asset, price_usd")
    .eq("id", adId)
    .maybeSingle();
  if (adRow) {
    assertP2pAmountLimit(String(adRow.asset), amount, Number(adRow.price_usd ?? 1));
  }

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

export async function sendMessage(
  orderId: string,
  senderId: string,
  body: string,
  imageUrl?: string | null,
) {
  const text = body.trim();
  if (!text && !imageUrl) throw new Error("Message is empty");
  const { error } = await supabase.from("p2p_messages").insert({
    order_id: orderId,
    sender_id: senderId,
    body: text || (imageUrl ? "📷 Image" : ""),
    image_url: imageUrl ?? null,
  });
  if (error) throw new Error(error.message);
}

/* ------------------------------- merchant program ----------------------- */

export type P2PMerchantTier = "none" | "verified" | "super";
export type P2PApplicationStatus = "pending" | "approved" | "rejected" | "cancelled";

export type P2PMerchant = {
  user_id: string;
  tier: P2PMerchantTier;
  is_featured: boolean;
  featured_until: string | null;
  badge_label: string | null;
  approved_at: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type P2PMerchantApplication = {
  id: string;
  user_id: string;
  requested_tier: P2PMerchantTier;
  status: P2PApplicationStatus;
  checklist_snapshot: Record<string, unknown>;
  applicant_note: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type P2PMerchantPublic = {
  user_id: string;
  tier: P2PMerchantTier;
  is_featured: boolean;
  featured_until: string | null;
  badge_label: string | null;
};

export function merchantCanList(m: P2PMerchant | null | undefined) {
  return !!m && (m.tier === "verified" || m.tier === "super");
}

export function isMerchantFeatured(m: Pick<P2PMerchantPublic, "is_featured" | "featured_until"> | null | undefined) {
  if (!m?.is_featured) return false;
  if (!m.featured_until) return true;
  return new Date(m.featured_until).getTime() > Date.now();
}

export async function fetchMyMerchant(): Promise<P2PMerchant | null> {
  const { data, error } = await (supabase as any).rpc("p2p_get_my_merchant");
  if (error) {
    if (/p2p_get_my_merchant|schema cache|does not exist/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  return (data as P2PMerchant | null) ?? null;
}

export async function fetchMerchants(ids: string[]): Promise<Record<string, P2PMerchantPublic>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return {};
  const { data, error } = await (supabase as any).rpc("p2p_fetch_merchants", { _ids: unique });
  if (error) return {};
  const map: Record<string, P2PMerchantPublic> = {};
  for (const row of (data ?? []) as P2PMerchantPublic[]) {
    map[row.user_id] = {
      ...row,
      is_featured: isMerchantFeatured(row),
    };
  }
  return map;
}

export async function fetchMyMerchantApplication(): Promise<P2PMerchantApplication | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data, error } = await (supabase as any)
    .from("p2p_merchant_applications")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (/p2p_merchant_applications|schema cache|does not exist/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  return (data as P2PMerchantApplication | null) ?? null;
}

export async function applyMerchant(
  requestedTier: "verified" | "super",
  note?: string,
): Promise<P2PMerchantApplication> {
  const { data, error } = await (supabase as any).rpc("p2p_apply_merchant", {
    _requested_tier: requestedTier,
    _note: note ?? null,
  });
  if (error) throw new Error(error.message);
  return data as P2PMerchantApplication;
}

export async function cancelMerchantApplication(id: string) {
  const { data, error } = await (supabase as any).rpc("p2p_cancel_merchant_application", {
    _id: id,
  });
  if (error) throw new Error(error.message);
  return data as P2PMerchantApplication;
}

export async function adminListMerchantApplications(
  status: "pending" | "all" | "approved" | "rejected" = "pending",
): Promise<P2PMerchantApplication[]> {
  const { data, error } = await (supabase as any).rpc("admin_list_p2p_merchant_applications", {
    _status: status,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as P2PMerchantApplication[];
}

export async function adminReviewMerchant(input: {
  applicationId: string;
  approve: boolean;
  tier?: "verified" | "super";
  featured?: boolean;
  featuredDays?: number | null;
  adminNote?: string;
}) {
  const { data, error } = await (supabase as any).rpc("admin_review_p2p_merchant", {
    _application_id: input.applicationId,
    _approve: input.approve,
    _tier: input.tier ?? null,
    _featured: input.featured ?? false,
    _admin_note: input.adminNote ?? null,
    _featured_days: input.featuredDays ?? null,
  });
  if (error) throw new Error(error.message);
  return data as P2PMerchant;
}

export async function adminSetMerchant(input: {
  userId: string;
  tier: P2PMerchantTier;
  featured?: boolean;
  featuredDays?: number | null;
  note?: string;
}) {
  const { data, error } = await (supabase as any).rpc("admin_set_p2p_merchant", {
    _user_id: input.userId,
    _tier: input.tier,
    _featured: input.featured ?? false,
    _featured_days: input.featuredDays ?? null,
    _note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
  return data as P2PMerchant;
}

/** Sort ads: featured merchants first, then super > verified, then price. */
export function sortAdsByMerchantRank(
  ads: P2PAd[],
  merchants: Record<string, P2PMerchantPublic>,
  side: "sell" | "buy",
): P2PAd[] {
  const tierRank = (t?: P2PMerchantTier) =>
    t === "super" ? 2 : t === "verified" ? 1 : 0;

  return [...ads].sort((a, b) => {
    const ma = merchants[a.user_id];
    const mb = merchants[b.user_id];
    const fa = ma?.is_featured ? 1 : 0;
    const fb = mb?.is_featured ? 1 : 0;
    if (fa !== fb) return fb - fa;
    const ta = tierRank(ma?.tier);
    const tb = tierRank(mb?.tier);
    if (ta !== tb) return tb - ta;
    const pa = Number(a.price_usd);
    const pb = Number(b.price_usd);
    return side === "sell" ? pa - pb : pb - pa;
  });
}


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

export type P2PRating = Tables<"p2p_ratings">;

export type P2PRatingStats = {
  id: string;
  rating_count: number;
  avg_score: number | null;
  positive_rate: number | null;
};

export const P2P_RATING_TAGS = [
  "Fast payment",
  "Friendly",
  "Patient",
  "Good communication",
  "Reliable",
  "Clear instructions",
] as const;

export async function submitOrderRating(input: {
  orderId: string;
  score: number;
  tags?: string[];
  comment?: string | null;
}): Promise<P2PRating> {
  const { data, error } = await supabase.rpc("p2p_submit_rating", {
    _order_id: input.orderId,
    _score: input.score,
    _tags: input.tags ?? [],
    _comment: input.comment ?? null,
  });
  if (error) throw new Error(error.message);
  return data as P2PRating;
}

export async function fetchMyRatingForOrder(orderId: string): Promise<P2PRating | null> {
  const { data, error } = await supabase.rpc("p2p_my_rating_for_order", {
    _order_id: orderId,
  });
  if (error) return null;
  return (data as P2PRating | null) ?? null;
}

export async function fetchRatingStats(ids: string[]): Promise<Record<string, P2PRatingStats>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return {};
  const { data, error } = await supabase.rpc("p2p_rating_stats", { _ids: unique });
  if (error) {
    return Object.fromEntries(
      unique.map((id) => [
        id,
        { id, rating_count: 0, avg_score: null, positive_rate: null } satisfies P2PRatingStats,
      ]),
    );
  }
  const map: Record<string, P2PRatingStats> = {};
  for (const row of data ?? []) {
    map[row.id] = {
      id: row.id,
      rating_count: Number(row.rating_count ?? 0),
      avg_score: row.avg_score == null ? null : Number(row.avg_score),
      positive_rate: row.positive_rate == null ? null : Number(row.positive_rate),
    };
  }
  return map;
}

export function formatPositiveRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "N/A";
  return `${Number(rate).toFixed(rate >= 100 || rate === 0 ? 0 : 2)}%`;
}

