/**
 * Platform fee treasury — all OpenToken / OpenDEX fees credit this account.
 * Prefer matching wallet address; fall back to profile username @openpay.
 */
export const PLATFORM_FEE_TREASURY_USERNAME = "openpay";
export const PLATFORM_FEE_TREASURY_ADDRESS =
  "0xc847682465ea537c3957cd46eff2c7229faefde1";

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

/** Resolve the platform treasury wallet (address first, then @openpay). */
export async function resolvePlatformTreasuryWallet(
  admin: AdminClient,
): Promise<TreasuryWallet | null> {
  const addr = PLATFORM_FEE_TREASURY_ADDRESS.toLowerCase();

  const { data: byAddr } = await admin
    .from("wallets")
    .select("id, user_id, address, ousd_balance")
    .ilike("address", addr)
    .limit(1)
    .maybeSingle();
  if (byAddr?.id) return byAddr as TreasuryWallet;

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", PLATFORM_FEE_TREASURY_USERNAME)
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
      "[platform-fee] treasury wallet not found for",
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
