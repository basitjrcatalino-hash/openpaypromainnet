/**
 * Top-up fee — deducted from gross payment; credited to admin-configured fee wallet.
 */

export type TopupFeeSettings = {
  feeBps: number;
  feeWalletAddress: string | null;
};

export type TopupFeeBreakdown = {
  gross: number;
  fee: number;
  net: number;
  feeBps: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = { from: (table: string) => any };

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}

export function calcTopupFee(gross: number, feeBps: number): TopupFeeBreakdown {
  const g = round8(Math.max(0, gross));
  const bps = Math.max(0, Math.min(10_000, Math.floor(feeBps)));
  if (!(g > 0) || bps <= 0) {
    return { gross: g, fee: 0, net: g, feeBps: bps };
  }
  const fee = round8((g * bps) / 10_000);
  const net = round8(Math.max(0, g - fee));
  return { gross: g, fee, net, feeBps: bps };
}

let cachedSettings: TopupFeeSettings | null = null;
let cachedAt = 0;
const CACHE_MS = 30_000;

export async function getTopupFeeSettings(admin: DbClient): Promise<TopupFeeSettings> {
  if (cachedSettings && Date.now() - cachedAt < CACHE_MS) return cachedSettings;
  const { data } = await admin
    .from("topup_settings")
    .select("fee_bps, fee_wallet_address")
    .eq("id", 1)
    .maybeSingle();
  const settings: TopupFeeSettings = {
    feeBps: Number(data?.fee_bps ?? 0),
    feeWalletAddress: data?.fee_wallet_address?.trim() || null,
  };
  cachedSettings = settings;
  cachedAt = Date.now();
  return settings;
}

export function clearTopupFeeSettingsCache() {
  cachedSettings = null;
  cachedAt = 0;
}

async function resolveFeeWallet(
  admin: DbClient,
  addressOrUser: string,
): Promise<{ id: string; ousd_balance?: number | null } | null> {
  const raw = addressOrUser.trim();
  if (!raw) return null;

  if (/^0x/i.test(raw)) {
    const { data } = await admin
      .from("wallets")
      .select("id, ousd_balance")
      .ilike("address", raw.toLowerCase())
      .limit(1)
      .maybeSingle();
    return data ?? null;
  }

  const handle = raw.replace(/^@+/, "").toLowerCase();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", handle)
    .limit(1)
    .maybeSingle();
  if (!profile?.id) return null;

  const { data } = await admin
    .from("wallets")
    .select("id, ousd_balance")
    .eq("user_id", profile.id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function creditFeeWallet(
  admin: DbClient,
  opts: {
    feeWalletAddress: string;
    feeAmount: number;
    sourceWalletId: string;
    memo: string;
    counterparty: string;
  },
): Promise<boolean> {
  const fee = round8(opts.feeAmount);
  if (!(fee > 0)) return true;

  const treasury = await resolveFeeWallet(admin, opts.feeWalletAddress);
  if (!treasury) {
    console.error("[topup-fee] fee wallet not found:", opts.feeWalletAddress);
    return false;
  }

  const { data: fresh } = await admin
    .from("wallets")
    .select("ousd_balance")
    .eq("id", treasury.id)
    .maybeSingle();
  const next = round8(Number(fresh?.ousd_balance ?? treasury.ousd_balance ?? 0) + fee);
  const { error } = await admin.from("wallets").update({ ousd_balance: next }).eq("id", treasury.id);
  if (error) {
    console.error("[topup-fee] fee credit failed:", error.message);
    return false;
  }

  try {
    await admin.from("transactions").insert({
      wallet_id: treasury.id,
      type: "receive",
      status: "confirmed",
      token_symbol: "OUSD",
      counterparty: opts.counterparty,
      amount: fee,
      usd_value: fee,
      memo: opts.memo,
    });
  } catch (e) {
    console.warn("[topup-fee] fee ledger insert failed", (e as Error).message);
  }

  return true;
}

export type CreditTopupWithFeeOpts = {
  /** Client with permission to update the user wallet (user or service role). */
  client: DbClient;
  /** Service-role client for fee wallet credit (falls back to client). */
  admin?: DbClient;
  userWalletId: string;
  grossAmount: number;
  counterparty: string;
  memo: string;
  txHash?: string | null;
  /** Override fee settings (optional — normally loaded from topup_settings). */
  feeSettings?: TopupFeeSettings;
};

export type CreditTopupWithFeeResult = {
  grossAmount: number;
  netAmount: number;
  feeAmount: number;
  feeBps: number;
  balance: number;
  feeCredited: boolean;
  alreadyCredited?: boolean;
};

/**
 * Credit user wallet (net) and route fee to configured fee wallet.
 * `grossAmount` is what the user paid; user receives gross − fee.
 * When `txHash` is set, skips credit if that hash already exists (idempotent).
 */
export async function creditTopupWithFee(
  opts: CreditTopupWithFeeOpts,
): Promise<CreditTopupWithFeeResult> {
  const admin = opts.admin ?? opts.client;
  const settings = opts.feeSettings ?? (await getTopupFeeSettings(admin));
  const { gross, fee, net, feeBps } = calcTopupFee(opts.grossAmount, settings.feeBps);

  const { data: wallet } = await opts.client
    .from("wallets")
    .select("id, ousd_balance")
    .eq("id", opts.userWalletId)
    .maybeSingle();
  if (!wallet) throw new Error("Wallet not found");

  const curBal = Number(wallet.ousd_balance ?? 0);

  // Idempotency: never credit twice for the same payment key.
  if (opts.txHash) {
    const { data: byHash } = await admin
      .from("transactions")
      .select("id")
      .eq("tx_hash", opts.txHash)
      .limit(1)
      .maybeSingle();
    if (byHash) {
      return {
        grossAmount: gross,
        netAmount: net,
        feeAmount: fee,
        feeBps,
        balance: curBal,
        feeCredited: false,
        alreadyCredited: true,
      };
    }
  }
  if (opts.counterparty) {
    const { data: byCp } = await admin
      .from("transactions")
      .select("id")
      .eq("counterparty", opts.counterparty)
      .limit(1)
      .maybeSingle();
    if (byCp) {
      return {
        grossAmount: gross,
        netAmount: net,
        feeAmount: fee,
        feeBps,
        balance: curBal,
        feeCredited: false,
        alreadyCredited: true,
      };
    }
  }

  const newBal = round8(curBal + net);
  const { error: uErr } = await opts.client
    .from("wallets")
    .update({ ousd_balance: newBal })
    .eq("id", opts.userWalletId);
  if (uErr) throw uErr;

  const txRow: Record<string, unknown> = {
    wallet_id: opts.userWalletId,
    type: "buy",
    status: "confirmed",
    token_symbol: "OUSD",
    counterparty: opts.counterparty,
    amount: net,
    usd_value: net,
    memo:
      fee > 0
        ? `${opts.memo} · gross ${gross} OUSD · fee ${fee} (${(feeBps / 100).toFixed(2)}%)`
        : opts.memo,
  };
  if (opts.txHash) txRow.tx_hash = opts.txHash;

  const { data: inserted, error: txErr } = await opts.client
    .from("transactions")
    .insert(txRow)
    .select("id, type, token_symbol, amount, memo, counterparty, status, created_at, wallet_id")
    .single();

  // Unique / race: another request already inserted this payment — do not leave a double balance.
  if (txErr) {
    const msg = String(txErr.message || "");
    if (/duplicate|unique|tx_hash/i.test(msg) && opts.txHash) {
      // Best-effort rollback of our balance bump
      await opts.client
        .from("wallets")
        .update({ ousd_balance: curBal })
        .eq("id", opts.userWalletId);
      return {
        grossAmount: gross,
        netAmount: net,
        feeAmount: fee,
        feeBps,
        balance: curBal,
        feeCredited: false,
        alreadyCredited: true,
      };
    }
    throw txErr;
  }

  try {
    const { notifyWalletTransaction } = await import("./tx-alerts.server");
    await notifyWalletTransaction(admin as never, opts.userWalletId, inserted ?? {
      type: "buy",
      token_symbol: "OUSD",
      amount: net,
      memo: String(txRow.memo ?? opts.memo),
      counterparty: opts.counterparty,
      status: "confirmed",
      wallet_id: opts.userWalletId,
    });
  } catch (e) {
    console.warn("[topup-fee] tx alert failed", e);
  }

  let feeCredited = false;
  if (fee > 0 && settings.feeWalletAddress) {
    feeCredited = await creditFeeWallet(admin, {
      feeWalletAddress: settings.feeWalletAddress,
      feeAmount: fee,
      sourceWalletId: opts.userWalletId,
      memo: `Top-up fee · ${opts.memo}`,
      counterparty: `topup_fee:${opts.counterparty}`,
    });
  } else if (fee > 0) {
    console.warn("[topup-fee] fee configured but no fee_wallet_address set; fee not credited");
  }

  return {
    grossAmount: gross,
    netAmount: net,
    feeAmount: fee,
    feeBps,
    balance: newBal,
    feeCredited,
  };
}
