/**
 * Platform fee treasury — all OpenToken / OpenDEX / major-buy fees credit this account.
 *
 * Resolution order:
 * 1. Admin Top-up Settings `fee_wallet_address` (0x… or @username / username)
 * 2. Hardcoded PLATFORM_FEE_TREASURY_ADDRESS
 * 3. Profile username @openpay
 */
export const PLATFORM_FEE_TREASURY_USERNAME = "openpay";
export const PLATFORM_FEE_TREASURY_ADDRESS =
  "0xc847682465ea537c3957cd46eff2c7229faefde1";

/** Platform trade fee (Spot majors / OpenToken / OpenDEX / Perps) — 30 bps = 0.30%. */
export const PLATFORM_TRADE_FEE_BPS = 30;

export function platformTradeFeePct(feeBps = PLATFORM_TRADE_FEE_BPS) {
  return feeBps / 100;
}

/** Perp fee on notional (margin × leverage), same bps as Spot. */
export function applyPerpNotionalFee(
  margin: number,
  leverage: number,
  feeBps = PLATFORM_TRADE_FEE_BPS,
): { notional: number; fee: number; totalDebit: number; feeBps: number } {
  const notional = round8(Math.max(0, margin) * Math.max(0, leverage));
  const { fee } = applyPlatformTradeFee(notional, feeBps);
  return {
    notional,
    fee,
    totalDebit: round8(Math.max(0, margin) + fee),
    feeBps,
  };
}

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}

type AdminClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export type TreasuryWallet = {
  id: string;
  user_id: string;
  address: string;
  ousd_balance?: number | null;
};

function normalizeFeeRef(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  return s.replace(/^@+/, "").toLowerCase();
}

async function resolveWalletByAddress(
  admin: AdminClient,
  address: string,
): Promise<TreasuryWallet | null> {
  const { data } = await admin
    .from("wallets")
    .select("id, user_id, address, ousd_balance")
    .ilike("address", address.toLowerCase())
    .limit(1)
    .maybeSingle();
  return (data as TreasuryWallet | null) ?? null;
}

async function resolveWalletByUsername(
  admin: AdminClient,
  username: string,
): Promise<TreasuryWallet | null> {
  const handle = normalizeFeeRef(username);
  if (!handle) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", handle)
    .limit(1)
    .maybeSingle();
  if (!profile?.id) return null;

  const { data: byUser } = await admin
    .from("wallets")
    .select("id, user_id, address, ousd_balance")
    .eq("user_id", profile.id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (byUser as TreasuryWallet | null) ?? null;
}

async function resolveConfiguredFeeWallet(admin: AdminClient): Promise<TreasuryWallet | null> {
  try {
    const { data } = await admin
      .from("topup_settings")
      .select("fee_wallet_address")
      .eq("id", 1)
      .maybeSingle();
    const raw = (data?.fee_wallet_address as string | null | undefined)?.trim();
    if (!raw) return null;

    if (raw.startsWith("0x") || raw.startsWith("0X")) {
      return resolveWalletByAddress(admin, raw);
    }
    // @openpay / openpay / username
    return resolveWalletByUsername(admin, raw);
  } catch {
    return null;
  }
}

/** Resolve the platform treasury wallet (admin setting → address → @openpay). */
export async function resolvePlatformTreasuryWallet(
  admin: AdminClient,
): Promise<TreasuryWallet | null> {
  const configured = await resolveConfiguredFeeWallet(admin);
  if (configured) return configured;

  const byAddr = await resolveWalletByAddress(admin, PLATFORM_FEE_TREASURY_ADDRESS);
  if (byAddr) return byAddr;

  return resolveWalletByUsername(admin, PLATFORM_FEE_TREASURY_USERNAME);
}

export function applyPlatformTradeFee(
  amount: number,
  feeBps = PLATFORM_TRADE_FEE_BPS,
): { fee: number; net: number; feeBps: number } {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { fee: 0, net: 0, feeBps };
  }
  const fee = round8((amount * feeBps) / 10_000);
  const net = round8(Math.max(0, amount - fee));
  return { fee, net, feeBps };
}

/** Credit OUSD platform fee to the treasury wallet. */
export async function creditPlatformFeeOusd(
  admin: AdminClient,
  opts: {
    amount: number;
    memo: string;
    sourceWalletId?: string | null;
    counterparty?: string;
  },
): Promise<{ ok: boolean; treasuryWalletId?: string; skipped?: string }> {
  const amount = round8(opts.amount);
  if (!(amount > 0)) return { ok: true, skipped: "zero" };

  const treasury = await resolvePlatformTreasuryWallet(admin);
  if (!treasury) {
    console.error(
      "[platform-fee] treasury wallet not found for configured fee wallet /",
      PLATFORM_FEE_TREASURY_ADDRESS,
      `@${PLATFORM_FEE_TREASURY_USERNAME}`,
    );
    return { ok: false, skipped: "treasury_missing" };
  }

  const { data: fresh } = await admin
    .from("wallets")
    .select("ousd_balance")
    .eq("id", treasury.id)
    .maybeSingle();
  const next = round8(Number(fresh?.ousd_balance ?? treasury.ousd_balance ?? 0) + amount);
  const { error } = await admin.from("wallets").update({ ousd_balance: next }).eq("id", treasury.id);
  if (error) {
    console.error("[platform-fee] OUSD credit failed", error.message);
    return { ok: false, skipped: error.message };
  }

  try {
    await admin.from("transactions").insert({
      wallet_id: treasury.id,
      type: "receive",
      status: "confirmed",
      token_symbol: "OUSD",
      counterparty: opts.counterparty ?? opts.sourceWalletId ?? "platform_fee",
      amount,
      usd_value: amount,
      memo: opts.memo,
    });
  } catch (e) {
    console.warn("[platform-fee] ledger insert failed", (e as Error).message);
  }

  return { ok: true, treasuryWalletId: treasury.id };
}

/** Credit a non-OUSD token fee to the treasury wallet holdings. */
export async function creditPlatformFeeToken(
  admin: AdminClient,
  opts: {
    amount: number;
    tokenId: string;
    tokenSymbol: string;
    usdValue?: number;
    memo: string;
    sourceWalletId?: string | null;
  },
): Promise<{ ok: boolean; treasuryWalletId?: string; skipped?: string }> {
  const amount = round8(opts.amount);
  if (!(amount > 0)) return { ok: true, skipped: "zero" };

  const treasury = await resolvePlatformTreasuryWallet(admin);
  if (!treasury) {
    console.error("[platform-fee] treasury wallet not found");
    return { ok: false, skipped: "treasury_missing" };
  }

  const { data: hold } = await admin
    .from("token_holdings")
    .select("id, balance")
    .eq("wallet_id", treasury.id)
    .eq("token_id", opts.tokenId)
    .maybeSingle();

  if (hold?.id) {
    const { error } = await admin
      .from("token_holdings")
      .update({
        balance: round8(Number(hold.balance) + amount),
        updated_at: new Date().toISOString(),
      })
      .eq("id", hold.id);
    if (error) return { ok: false, skipped: error.message };
  } else {
    const { error } = await admin.from("token_holdings").insert({
      wallet_id: treasury.id,
      token_id: opts.tokenId,
      balance: amount,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, skipped: error.message };
  }

  try {
    await admin.from("transactions").insert({
      wallet_id: treasury.id,
      type: "receive",
      status: "confirmed",
      token_id: opts.tokenId,
      token_symbol: opts.tokenSymbol,
      counterparty: opts.sourceWalletId ?? "platform_fee",
      amount,
      usd_value: opts.usdValue ?? null,
      memo: opts.memo,
    });
  } catch {
    /* optional */
  }

  return { ok: true, treasuryWalletId: treasury.id };
}
