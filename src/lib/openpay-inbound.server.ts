// OpenPay → OpenPay Pro inbound transfers (server helpers).
// Note: pro_xfer:@username:ref | pro_xfer:0x…:ref | pro_xfer:uid_<uuid>:ref

import { createHash } from "crypto";

export const PRO_XFER_PREFIX = "pro_xfer:";

export type InboundNoteParts = {
  handle: string; // username, 0x address, or uid_xxx
  ref: string;
  raw: string;
};

export function isProWalletAddress(v: string): boolean {
  return /^0x[a-f0-9]{40}$/i.test(v.trim());
}

export function buildInboundNote(handle: string, ref?: string): string {
  const h = handle.trim().replace(/^@+/, "");
  const r = ref || `r${Date.now().toString(36)}`;
  // Prefer raw 0x / uid_ — do not prefix @
  if (isProWalletAddress(h) || /^uid_/i.test(h)) {
    return `${PRO_XFER_PREFIX}${h}:${r}`;
  }
  return `${PRO_XFER_PREFIX}@${h}:${r}`;
}

export function parseInboundNote(note: string): InboundNoteParts | null {
  const raw = (note || "").trim();
  if (!raw.toLowerCase().startsWith(PRO_XFER_PREFIX)) return null;
  const rest = raw.slice(PRO_XFER_PREFIX.length);

  // 0x address contains no ':' — split on last ':' if address-shaped prefix
  const addrMatch = rest.match(/^(0x[a-fA-F0-9]{40}):(.+)$/);
  if (addrMatch) {
    return { handle: addrMatch[1], ref: addrMatch[2].trim(), raw };
  }

  // @alice:ref  OR  uid_uuid:ref  OR  alice:ref
  const m = rest.match(/^@?([^:]+):(.+)$/);
  if (!m) return null;
  return { handle: m[1].trim(), ref: m[2].trim(), raw };
}

export function partnerKeyFromEnv(): string {
  return (
    process.env.OPENPAY_PARTNER_API_KEY ||
    process.env.OPENPAY_API_KEY ||
    process.env.OPENPAY_TRANSFER_API_KEY ||
    ""
  )
    .trim()
    .replace(/^["']+|["']+$/g, "");
}

export function sha256Hex(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

/** Credit a Pro user's OUSD wallet from an OpenPay inbound payment (idempotent). */
export async function creditProUserFromOpenPay(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any;
  toHandle: string;
  amount: number;
  openpayTxId: string;
  note?: string;
  fromLabel?: string;
}): Promise<{
  credited: boolean;
  already?: boolean;
  userId: string;
  walletId: string;
  balance: number;
  username?: string | null;
}> {
  const amount = Number(opts.amount);
  if (!(amount > 0) || amount > 1_000_000) {
    throw new Error("Invalid amount");
  }
  if (!opts.openpayTxId || opts.openpayTxId.length < 4) {
    throw new Error("openpay_tx_id required");
  }

  const counterparty = `openpay-in:${opts.openpayTxId}`;
  const { data: existing } = await opts.admin
    .from("transactions")
    .select("id, wallet_id")
    .eq("counterparty", counterparty)
    .limit(1)
    .maybeSingle();
  if (existing) {
    const { data: w } = await opts.admin
      .from("wallets")
      .select("id, user_id, ousd_balance")
      .eq("id", existing.wallet_id)
      .maybeSingle();
    return {
      credited: true,
      already: true,
      userId: w?.user_id ?? "",
      walletId: w?.id ?? existing.wallet_id,
      balance: Number(w?.ousd_balance ?? 0),
    };
  }

  const { findLocalProfileByHandle, normalizeRecipientId } =
    await import("./recipient-resolve");

  const handle = normalizeRecipientId(opts.toHandle);
  let userId: string | null = null;
  let username: string | null = null;

  if (/^uid_/i.test(handle)) {
    userId = handle.replace(/^uid_/i, "");
  } else if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(handle)
  ) {
    userId = handle;
  } else if (isProWalletAddress(handle)) {
    const addr = handle;
    // Case-insensitive match (Pro addresses may be mixed case)
    const { data: rows } = await opts.admin
      .from("wallets")
      .select("*")
      .ilike("address", addr)
      .limit(1);
    const byAddr = Array.isArray(rows) ? rows[0] : rows;
    if (!byAddr) throw new Error("OpenPay Pro wallet address not found");
    const newBal = Number(byAddr.ousd_balance ?? 0) + amount;
    const { error: uErr } = await opts.admin
      .from("wallets")
      .update({ ousd_balance: newBal })
      .eq("id", byAddr.id);
    if (uErr) throw new Error(uErr.message);
    const { error: tErr } = await opts.admin.from("transactions").insert({
      wallet_id: byAddr.id,
      type: "receive",
      status: "confirmed",
      token_symbol: "OUSD",
      counterparty,
      amount,
      usd_value: amount,
      memo:
        opts.note ||
        `OpenPay transfer${opts.fromLabel ? ` from ${opts.fromLabel}` : ""} → ${addr.slice(0, 10)}…`,
    });
    if (tErr) throw new Error(tErr.message);
    try {
      const { notifyWalletTransaction } = await import("./tx-alerts.server");
      await notifyWalletTransaction(opts.admin as never, byAddr.id, {
        type: "receive",
        token_symbol: "OUSD",
        amount,
        memo: opts.note || `OpenPay transfer received`,
        counterparty,
        status: "confirmed",
        wallet_id: byAddr.id,
      });
    } catch (e) {
      console.warn("[openpay-inbound] tx alert failed", e);
    }
    return {
      credited: true,
      userId: byAddr.user_id,
      walletId: byAddr.id,
      balance: newBal,
    };
  } else {
    const prof = await findLocalProfileByHandle(opts.admin, handle);
    if (!prof?.id) throw new Error(`OpenPay Pro user not found: @${handle}`);
    userId = prof.id;
    username = prof.username;
  }

  const { data: wallet, error: wErr } = await opts.admin
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (wErr || !wallet) throw new Error("Recipient wallet not found on OpenPay Pro");

  const newBal = Number(wallet.ousd_balance ?? 0) + amount;
  const { error: uErr } = await opts.admin
    .from("wallets")
    .update({ ousd_balance: newBal })
    .eq("id", wallet.id);
  if (uErr) throw new Error(uErr.message);

  const { error: tErr } = await opts.admin.from("transactions").insert({
    wallet_id: wallet.id,
    type: "receive",
    status: "confirmed",
    token_symbol: "OUSD",
    counterparty,
    amount,
    usd_value: amount,
    memo:
      opts.note ||
      `OpenPay transfer${opts.fromLabel ? ` from ${opts.fromLabel}` : ""}`,
  });
  if (tErr) throw new Error(tErr.message);

  try {
    const { notifyWalletTransaction } = await import("./tx-alerts.server");
    await notifyWalletTransaction(opts.admin as never, wallet.id, {
      type: "receive",
      token_symbol: "OUSD",
      amount,
      memo:
        opts.note ||
        `OpenPay transfer${opts.fromLabel ? ` from ${opts.fromLabel}` : ""}`,
      counterparty,
      status: "confirmed",
      wallet_id: wallet.id,
    });
  } catch (e) {
    console.warn("[openpay-inbound] tx alert failed", e);
  }

  return {
    credited: true,
    userId: wallet.user_id,
    walletId: wallet.id,
    balance: newBal,
    username,
  };
}
