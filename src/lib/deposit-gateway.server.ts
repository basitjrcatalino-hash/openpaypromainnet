/**
 * Multi-Chain Deposit Gateway — server-only core.
 *
 * Modular blockchain adapters: a chain row in `deposit_chains` carries the
 * family ("evm" | "solana") + RPC endpoint, so new chains/tokens can be added
 * from the admin panel without touching this file.
 *
 * Do NOT import this module from route/component code.
 */

export type ChainRow = {
  id: string;
  key: string;
  name: string;
  family: string;
  rpc_url: string | null;
  explorer_url: string | null;
  required_confirmations: number;
  is_enabled: boolean;
  maintenance_mode: boolean;
};

export type TokenRow = {
  id: string;
  chain_id: string;
  name: string;
  symbol: string;
  contract_address: string | null;
  decimals: number;
  deposit_enabled: boolean;
  min_deposit: number;
  max_deposit: number | null;
  deposit_fee_bps: number;
  credit_symbol: string;
  usd_rate: number | null;
  status: string;
};

export type OnChainDeposit = {
  found: boolean;
  amount: number;
  from: string | null;
  to: string | null;
  blockNumber: number | null;
  confirmations: number;
  failed: boolean;
  reason?: string;
};

/* ------------------------------------------------------------------ utils */

export function isEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v.trim());
}

export function isSolanaAddress(v: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim());
}

/** Pi Network runs a Stellar-derived chain: G… public keys, M… muxed accounts. */
export function isPiAddress(v: string): boolean {
  const a = v.trim().toUpperCase();
  return /^G[A-Z2-7]{55}$/.test(a) || /^M[A-Z2-7]{68}$/.test(a);
}

export function isValidAddressFor(family: string, address: string): boolean {
  if (family === "pi" || family === "stellar") return isPiAddress(address);
  return family === "solana" ? isSolanaAddress(address) : isEvmAddress(address);
}

export function isValidTxHash(family: string, hash: string): boolean {
  const h = hash.trim();
  if (family === "pi" || family === "stellar") return /^[a-fA-F0-9]{64}$/.test(h);
  if (family === "solana") return /^[1-9A-HJ-NP-Za-km-z]{80,100}$/.test(h);
  return /^0x[a-fA-F0-9]{64}$/.test(h);
}

export function explorerTxUrl(chain: Pick<ChainRow, "explorer_url" | "family">, hash: string) {
  const base = (chain.explorer_url || "").replace(/\/+$/, "");
  if (!base) return null;
  if (chain.family === "pi" || chain.family === "stellar") return `${base}/transactions/${hash}`;
  return `${base}/tx/${hash}`;
}

const DEFAULT_EVM_RPC: Record<string, string> = {
  ethereum: "https://eth.llamarpc.com",
  base: "https://mainnet.base.org",
  polygon: "https://polygon-rpc.com",
  bnb: "https://bsc-dataseed.binance.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  optimism: "https://mainnet.optimism.io",
  avalanche: "https://api.avax.network/ext/bc/C/rpc",
};
const DEFAULT_SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const DEFAULT_PI_HORIZON = "https://api.mainnet.minepi.com";

export function resolveRpc(chain: ChainRow): string | null {
  if (chain.rpc_url?.trim()) return chain.rpc_url.trim().replace(/\/+$/, "");
  if (chain.family === "pi" || chain.family === "stellar") {
    return (process.env.PI_HORIZON_URL || DEFAULT_PI_HORIZON).replace(/\/+$/, "");
  }
  if (chain.family === "solana") return process.env.SOLANA_RPC_URL || DEFAULT_SOLANA_RPC;
  return DEFAULT_EVM_RPC[chain.key] ?? null;
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${method} failed [${res.status}]: ${await res.text()}`);
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || `RPC ${method} error`);
  return body.result as T;
}

function hexToBigInt(v: string | null | undefined): bigint {
  if (!v) return 0n;
  try {
    return BigInt(v);
  } catch {
    return 0n;
  }
}

function scaled(raw: bigint, decimals: number): number {
  const s = raw.toString().padStart(decimals + 1, "0");
  const int = s.slice(0, s.length - decimals);
  const frac = decimals ? s.slice(s.length - decimals) : "";
  return Number(`${int}.${frac || "0"}`);
}

/* -------------------------------------------------------------- EVM adapter */

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function verifyEvm(
  chain: ChainRow,
  token: TokenRow,
  toAddress: string,
  txHash: string,
): Promise<OnChainDeposit> {
  const url = resolveRpc(chain);
  if (!url) return { found: false, amount: 0, from: null, to: null, blockNumber: null, confirmations: 0, failed: false, reason: "No RPC endpoint configured" };

  const receipt = await rpc<any>(url, "eth_getTransactionReceipt", [txHash]);
  if (!receipt) {
    return { found: false, amount: 0, from: null, to: null, blockNumber: null, confirmations: 0, failed: false, reason: "Transaction not found yet" };
  }
  const success = hexToBigInt(receipt.status) === 1n;
  const blockNumber = Number(hexToBigInt(receipt.blockNumber));
  const head = Number(hexToBigInt(await rpc<string>(url, "eth_blockNumber", [])));
  const confirmations = head >= blockNumber ? head - blockNumber + 1 : 0;

  if (!success) {
    return { found: true, amount: 0, from: receipt.from ?? null, to: null, blockNumber, confirmations, failed: true, reason: "Transaction reverted on-chain" };
  }

  const target = toAddress.toLowerCase();

  // Native coin transfer
  if (!token.contract_address) {
    const tx = await rpc<any>(url, "eth_getTransactionByHash", [txHash]);
    if (!tx || String(tx.to || "").toLowerCase() !== target) {
      return { found: true, amount: 0, from: tx?.from ?? null, to: tx?.to ?? null, blockNumber, confirmations, failed: true, reason: "Transfer was not sent to the deposit address" };
    }
    return {
      found: true,
      amount: scaled(hexToBigInt(tx.value), token.decimals),
      from: tx.from ?? null,
      to: tx.to ?? null,
      blockNumber,
      confirmations,
      failed: false,
    };
  }

  // ERC-20 Transfer log
  const contract = token.contract_address.toLowerCase();
  const logs: any[] = Array.isArray(receipt.logs) ? receipt.logs : [];
  const match = logs.find(
    (l) =>
      String(l.address || "").toLowerCase() === contract &&
      String(l.topics?.[0] || "").toLowerCase() === TRANSFER_TOPIC &&
      `0x${String(l.topics?.[2] || "").slice(-40)}`.toLowerCase() === target,
  );
  if (!match) {
    return { found: true, amount: 0, from: receipt.from ?? null, to: null, blockNumber, confirmations, failed: true, reason: `No ${token.symbol} transfer to the deposit address in this transaction` };
  }
  return {
    found: true,
    amount: scaled(hexToBigInt(match.data), token.decimals),
    from: `0x${String(match.topics?.[1] || "").slice(-40)}`,
    to: toAddress,
    blockNumber,
    confirmations,
    failed: false,
  };
}

/* ----------------------------------------------------------- Solana adapter */

async function verifySolana(
  chain: ChainRow,
  token: TokenRow,
  toAddress: string,
  signature: string,
): Promise<OnChainDeposit> {
  const url = resolveRpc(chain);
  if (!url) return { found: false, amount: 0, from: null, to: null, blockNumber: null, confirmations: 0, failed: false, reason: "No RPC endpoint configured" };

  const tx = await rpc<any>(url, "getTransaction", [
    signature,
    { maxSupportedTransactionVersion: 0, encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  if (!tx) {
    return { found: false, amount: 0, from: null, to: null, blockNumber: null, confirmations: 0, failed: false, reason: "Transaction not found yet" };
  }
  const slot = Number(tx.slot ?? 0);
  const head = Number(await rpc<number>(url, "getSlot", [{ commitment: "confirmed" }]));
  const confirmations = head >= slot ? head - slot + 1 : 0;

  if (tx.meta?.err) {
    return { found: true, amount: 0, from: null, to: null, blockNumber: slot, confirmations, failed: true, reason: "Transaction failed on-chain" };
  }

  const keys: any[] = tx.transaction?.message?.accountKeys ?? [];
  const signer = keys.find((k) => k?.signer)?.pubkey ?? null;

  // SPL token deposit — compare pre/post token balances for the owner.
  if (token.contract_address) {
    const pre: any[] = tx.meta?.preTokenBalances ?? [];
    const post: any[] = tx.meta?.postTokenBalances ?? [];
    const target = post.find(
      (b) => b.owner === toAddress && b.mint === token.contract_address,
    );
    if (!target) {
      return { found: true, amount: 0, from: signer, to: null, blockNumber: slot, confirmations, failed: true, reason: `No ${token.symbol} transfer to the deposit address` };
    }
    const before = pre.find((b) => b.accountIndex === target.accountIndex);
    const delta =
      Number(target.uiTokenAmount?.uiAmount ?? 0) - Number(before?.uiTokenAmount?.uiAmount ?? 0);
    if (delta <= 0) {
      return { found: true, amount: 0, from: signer, to: toAddress, blockNumber: slot, confirmations, failed: true, reason: "No incoming token amount detected" };
    }
    return { found: true, amount: delta, from: signer, to: toAddress, blockNumber: slot, confirmations, failed: false };
  }

  // Native SOL — compare lamport balances of the deposit address.
  const idx = keys.findIndex((k) => (typeof k === "string" ? k : k?.pubkey) === toAddress);
  if (idx < 0) {
    return { found: true, amount: 0, from: signer, to: null, blockNumber: slot, confirmations, failed: true, reason: "Deposit address is not part of this transaction" };
  }
  const delta =
    Number(tx.meta?.postBalances?.[idx] ?? 0) - Number(tx.meta?.preBalances?.[idx] ?? 0);
  if (delta <= 0) {
    return { found: true, amount: 0, from: signer, to: toAddress, blockNumber: slot, confirmations, failed: true, reason: "No incoming SOL detected" };
  }
  return {
    found: true,
    amount: delta / 1e9,
    from: signer,
    to: toAddress,
    blockNumber: slot,
    confirmations,
    failed: false,
  };
}

/** Adapter registry — add a family here to support a new chain type. */
export async function verifyOnChainDeposit(
  chain: ChainRow,
  token: TokenRow,
  toAddress: string,
  txHash: string,
): Promise<OnChainDeposit> {
  try {
    if (chain.family === "solana") return await verifySolana(chain, token, toAddress, txHash);
    return await verifyEvm(chain, token, toAddress, txHash);
  } catch (err) {
    return {
      found: false,
      amount: 0,
      from: null,
      to: null,
      blockNumber: null,
      confirmations: 0,
      failed: false,
      reason: (err as Error).message,
    };
  }
}

/* ------------------------------------------------------- crediting + ledger */

const BALANCE_COLUMNS = new Set([
  "ousd", "pi", "btc", "eth", "sol", "usdc", "usdt", "pyusd", "usdg", "usd1", "cash", "eurc",
]);

export function balanceColumnFor(symbol: string): string | null {
  const key = symbol.trim().toLowerCase();
  return BALANCE_COLUMNS.has(key) ? `${key}_balance` : null;
}

export async function logDepositEvent(
  admin: any,
  depositId: string | null,
  event: string,
  detail: Record<string, unknown> = {},
  actorId: string | null = null,
) {
  try {
    await admin.from("deposit_audit_logs").insert({
      deposit_id: depositId,
      actor_id: actorId,
      event,
      detail,
    });
  } catch (err) {
    console.error("[deposit audit]", err);
  }
}

/**
 * Idempotently credit a confirmed deposit: wallet balance + transaction row +
 * OpenLedger entry. Safe to call repeatedly — returns early once credited.
 */
export async function creditDeposit(admin: any, depositId: string) {
  const { data: dep, error } = await admin
    .from("deposits")
    .select("*")
    .eq("id", depositId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!dep) throw new Error("Deposit not found");
  if (dep.status === "credited") return dep;
  if (dep.credited_at) return dep;

  const { data: token } = await admin
    .from("deposit_tokens")
    .select("*")
    .eq("id", dep.token_id)
    .maybeSingle();

  const creditSymbol: string = token?.credit_symbol || dep.token_symbol;
  const feeBps = Number(token?.deposit_fee_bps ?? 0);
  const gross = Number(dep.amount);
  const fee = Math.round(((gross * feeBps) / 10000) * 1e8) / 1e8;
  const net = Math.max(0, Math.round((gross - fee) * 1e8) / 1e8);
  const rate = Number(token?.usd_rate ?? 0);
  const usdValue = rate > 0 ? Math.round(net * rate * 100) / 100 : Number(dep.usd_value || 0);

  // Resolve target wallet (active wallet by default).
  let walletId: string | null = dep.wallet_id;
  if (!walletId) {
    const { data: w } = await admin
      .from("wallets")
      .select("id")
      .eq("user_id", dep.user_id)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    walletId = w?.id ?? null;
  }
  if (!walletId) throw new Error("No wallet found for this user");

  const column = balanceColumnFor(creditSymbol);
  if (!column) throw new Error(`Unsupported credit asset: ${creditSymbol}`);

  const { data: wallet } = await admin
    .from("wallets")
    .select(`id, address, ${column}`)
    .eq("id", walletId)
    .maybeSingle();
  if (!wallet) throw new Error("Wallet not found");

  const current = Number((wallet as Record<string, unknown>)[column] ?? 0);
  const { error: balErr } = await admin
    .from("wallets")
    .update({ [column]: Math.round((current + net) * 1e8) / 1e8 })
    .eq("id", walletId);
  if (balErr) throw new Error(balErr.message);

  const { data: tx, error: txErr } = await admin
    .from("transactions")
    .insert({
      wallet_id: walletId,
      type: "receive",
      status: "confirmed",
      token_symbol: creditSymbol,
      counterparty: dep.from_address || `${dep.chain_key} deposit`,
      amount: net,
      usd_value: usdValue,
      tx_hash: dep.tx_hash,
      memo: `Deposit ${net} ${creditSymbol} via ${dep.chain_key}${fee > 0 ? ` (fee ${fee})` : ""}`,
    })
    .select("id")
    .maybeSingle();
  if (txErr) throw new Error(txErr.message);

  try {
    const { notifyWalletTransaction } = await import("./tx-alerts.server");
    await notifyWalletTransaction(admin as never, walletId, {
      id: tx?.id ? String(tx.id) : undefined,
      type: "receive",
      token_symbol: creditSymbol,
      amount: net,
      memo: `Deposit ${net} ${creditSymbol} via ${dep.chain_key}`,
      counterparty: dep.from_address || `${dep.chain_key} deposit`,
      status: "confirmed",
      wallet_id: walletId,
    });
  } catch (e) {
    console.warn("[deposit-gateway] tx alert failed", e);
  }

  // Mirror to OpenLedger (immutable, ignore duplicates).
  let ledgerId: string | null = null;
  const { data: entry } = await admin
    .from("ledger_entries")
    .upsert(
      {
        tx_id: tx?.id ?? null,
        wallet_id: walletId,
        from_address: dep.from_address || "external",
        to_address: (wallet as any).address,
        asset: creditSymbol,
        amount: net,
        usd_value: usdValue,
        type: "receive",
        status: "confirmed",
        tx_hash: dep.tx_hash,
        memo: `Multi-chain deposit · ${dep.chain_key} · block ${dep.block_number ?? "—"} · ${dep.confirmations} confirmations`,
        occurred_at: new Date().toISOString(),
      },
      { onConflict: "tx_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  ledgerId = entry?.id ?? null;

  const { data: updated } = await admin
    .from("deposits")
    .update({
      status: "credited",
      fee_amount: fee,
      credited_amount: net,
      usd_value: usdValue,
      wallet_id: walletId,
      transaction_id: tx?.id ?? null,
      ledger_entry_id: ledgerId,
      credited_at: new Date().toISOString(),
      confirmed_at: dep.confirmed_at ?? new Date().toISOString(),
      error: null,
    })
    .eq("id", depositId)
    .select("*")
    .maybeSingle();

  await logDepositEvent(admin, depositId, "deposit.credited", {
    net,
    fee,
    asset: creditSymbol,
    wallet_id: walletId,
  });

  return updated ?? dep;
}

/** Re-check one pending deposit against the chain and advance its status. */
export async function syncDeposit(admin: any, depositId: string) {
  const { data: dep } = await admin.from("deposits").select("*").eq("id", depositId).maybeSingle();
  if (!dep) throw new Error("Deposit not found");
  if (dep.status === "credited" || dep.status === "failed") return dep;

  const { data: chain } = await admin
    .from("deposit_chains")
    .select("*")
    .eq("id", dep.chain_id)
    .maybeSingle();
  const { data: token } = await admin
    .from("deposit_tokens")
    .select("*")
    .eq("id", dep.token_id)
    .maybeSingle();
  if (!chain || !token) throw new Error("Deposit configuration is no longer available");
  if (chain.maintenance_mode) return dep;

  const result = await verifyOnChainDeposit(chain, token, dep.to_address, dep.tx_hash);
  await logDepositEvent(admin, depositId, "deposit.checked", result as never);

  if (result.failed) {
    await admin
      .from("deposits")
      .update({ status: "failed", error: result.reason ?? "Verification failed" })
      .eq("id", depositId);
    return { ...dep, status: "failed", error: result.reason };
  }
  if (!result.found) {
    await admin.from("deposits").update({ error: result.reason ?? null }).eq("id", depositId);
    return { ...dep, error: result.reason };
  }

  const min = Number(token.min_deposit ?? 0);
  const max = token.max_deposit == null ? null : Number(token.max_deposit);
  if (result.amount < min) {
    const err = `Amount ${result.amount} ${token.symbol} is below the minimum deposit of ${min} ${token.symbol}`;
    await admin
      .from("deposits")
      .update({ status: "failed", amount: result.amount, error: err })
      .eq("id", depositId);
    return { ...dep, status: "failed", error: err };
  }
  if (max != null && result.amount > max) {
    await admin
      .from("deposits")
      .update({ status: "review", amount: result.amount, error: `Above maximum deposit of ${max} ${token.symbol} — manual review` })
      .eq("id", depositId);
    return { ...dep, status: "review" };
  }

  const required = Number(dep.required_confirmations || chain.required_confirmations || 12);
  const confirmed = result.confirmations >= required;

  await admin
    .from("deposits")
    .update({
      amount: result.amount,
      from_address: result.from ?? dep.from_address,
      block_number: result.blockNumber,
      confirmations: result.confirmations,
      status: confirmed ? "confirmed" : "pending",
      confirmed_at: confirmed ? (dep.confirmed_at ?? new Date().toISOString()) : null,
      error: null,
    })
    .eq("id", depositId);

  if (!confirmed) return { ...dep, status: "pending", confirmations: result.confirmations };

  return await creditDeposit(admin, depositId);
}
