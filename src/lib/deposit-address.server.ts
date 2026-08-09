/**
 * Per-user deposit address assignment + indexer registration (server-only).
 *
 * Custody is NOT performed here. Addresses come from a pool that an admin
 * loads from their custody / MPC provider (provider = 'pool'), and are handed
 * out atomically one-per-user-per-chain by `public.claim_deposit_address`.
 *
 * Do NOT import this module from route/component code.
 */

export type AssignedAddress = {
  id: string;
  chain_id: string;
  token_id: string | null;
  address: string;
  memo_tag: string | null;
  label: string | null;
  is_active: boolean;
  user_id: string | null;
};

/** Alchemy network slug per chain key (Address Activity webhooks). */
export const ALCHEMY_NETWORKS: Record<string, string> = {
  ethereum: "ETH_MAINNET",
  polygon: "MATIC_MAINNET",
  base: "BASE_MAINNET",
  arbitrum: "ARB_MAINNET",
  optimism: "OPT_MAINNET",
  bnb: "BNB_MAINNET",
  avalanche: "AVAX_MAINNET",
};

export function alchemyNetworkToChainKey(network: string): string | null {
  const found = Object.entries(ALCHEMY_NETWORKS).find(
    ([, v]) => v.toUpperCase() === network.trim().toUpperCase(),
  );
  return found ? found[0] : null;
}

function webhookIdFor(chainKey: string): string | null {
  const specific = process.env[`ALCHEMY_WEBHOOK_ID_${chainKey.toUpperCase()}`];
  return (specific || process.env.ALCHEMY_WEBHOOK_ID || "").trim() || null;
}

/**
 * Add a deposit address to the Alchemy Address Activity webhook so incoming
 * transfers are pushed to us. Best-effort: a failure never blocks the user.
 */
export async function registerAddressWithIndexer(
  chainKey: string,
  address: string,
): Promise<{ ok: boolean; reason?: string }> {
  const token = (process.env.ALCHEMY_AUTH_TOKEN || "").trim();
  const webhookId = webhookIdFor(chainKey);
  if (!token || !webhookId) return { ok: false, reason: "indexer_not_configured" };
  try {
    const res = await fetch("https://dashboard.alchemy.com/api/update-webhook-addresses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Alchemy-Token": token },
      body: JSON.stringify({
        webhook_id: webhookId,
        addresses_to_add: [address],
        addresses_to_remove: [],
      }),
    });
    if (!res.ok) return { ok: false, reason: `alchemy_${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/**
 * Return this user's personal receive address for a chain, claiming one from
 * the pool on first use. Returns null when no pooled address is available —
 * callers must then fall back to the shared platform address (or show
 * "temporarily unavailable"). Never fabricates an address.
 */
export async function assignUserDepositAddress(
  db: any,
  userId: string,
  chain: { id: string; key: string; family: string },
): Promise<AssignedAddress | null> {
  const { data: existing } = await db
    .from("deposit_addresses")
    .select("*")
    .eq("chain_id", chain.id)
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (existing) return existing as AssignedAddress;

  const { data, error } = await db.rpc("claim_deposit_address", {
    _user_id: userId,
    _chain_id: chain.id,
  });
  if (error) {
    console.error("[deposit address] claim failed", error.message);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as AssignedAddress | null;
  if (!row?.address) return null;

  if (chain.family === "evm") {
    const reg = await registerAddressWithIndexer(chain.key, row.address);
    if (!reg.ok) console.warn("[deposit address] indexer registration:", reg.reason);
  }
  return row;
}
