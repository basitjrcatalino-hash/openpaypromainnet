/**
 * Shared multi-chain transaction verification (server-only).
 *
 * Used by both the deposit gateway and the payment gateway.
 * Adapters are modular: add a new family by implementing `ChainAdapter`.
 */

export type ChainFamily = "evm" | "solana";

export type ChainConfig = {
  key: string;
  family: string;
  rpc_url: string | null;
  chain_id: number | null;
  required_confirmations: number;
};

export type TokenConfig = {
  symbol: string;
  contract_address: string | null;
  decimals: number;
};

export type VerifyInput = {
  chain: ChainConfig;
  token: TokenConfig;
  txHash: string;
  /** Address that must receive the funds. */
  toAddress: string;
};

export type VerifyResult = {
  found: boolean;
  /** Human amount received by `toAddress` in `token` units. */
  amount: number;
  from: string | null;
  blockNumber: number | null;
  confirmations: number;
  failed?: boolean;
  reason?: string;
};

const DEFAULT_RPC: Record<string, string> = {
  ethereum: "https://ethereum-rpc.publicnode.com",
  base: "https://base-rpc.publicnode.com",
  polygon: "https://polygon-bor-rpc.publicnode.com",
  bnb: "https://bsc-rpc.publicnode.com",
  arbitrum: "https://arbitrum-one-rpc.publicnode.com",
  optimism: "https://optimism-rpc.publicnode.com",
  avalanche: "https://avalanche-c-chain-rpc.publicnode.com",
  solana: "https://api.mainnet-beta.solana.com",
};

export function rpcUrlFor(chain: ChainConfig): string | null {
  return chain.rpc_url?.trim() || DEFAULT_RPC[chain.key] || null;
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${method} failed (${res.status})`);
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

function scaled(raw: bigint, decimals: number): number {
  const s = raw.toString().padStart(decimals + 1, "0");
  const int = s.slice(0, s.length - decimals);
  const frac = decimals ? s.slice(s.length - decimals) : "";
  return Number(`${int}${frac ? `.${frac}` : ""}`);
}

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function verifyEvm(input: VerifyInput, url: string): Promise<VerifyResult> {
  const hash = input.txHash.trim();
  const to = input.toAddress.trim().toLowerCase();

  const receipt = await rpc<any>(url, "eth_getTransactionReceipt", [hash]);
  if (!receipt) return { found: false, amount: 0, from: null, blockNumber: null, confirmations: 0 };

  const tx = await rpc<any>(url, "eth_getTransactionByHash", [hash]);
  const head = await rpc<string>(url, "eth_blockNumber", []);
  const blockNumber = Number(BigInt(receipt.blockNumber));
  const confirmations = Math.max(0, Number(BigInt(head)) - blockNumber + 1);
  const from = (receipt.from as string | undefined)?.toLowerCase() ?? null;

  if (receipt.status && BigInt(receipt.status) === 0n) {
    return { found: true, amount: 0, from, blockNumber, confirmations, failed: true, reason: "Transaction reverted on-chain" };
  }

  let amount = 0;
  const contract = input.token.contract_address?.trim().toLowerCase();

  if (!contract) {
    // Native asset transfer
    if ((tx?.to as string | undefined)?.toLowerCase() !== to) {
      return { found: true, amount: 0, from, blockNumber, confirmations, failed: true, reason: "Transaction was not sent to the expected address" };
    }
    amount = scaled(BigInt(tx.value ?? "0x0"), input.token.decimals);
  } else {
    for (const log of (receipt.logs ?? []) as any[]) {
      if ((log.address as string).toLowerCase() !== contract) continue;
      if ((log.topics?.[0] as string)?.toLowerCase() !== TRANSFER_TOPIC) continue;
      const topicTo = `0x${String(log.topics?.[2] ?? "").slice(-40)}`.toLowerCase();
      if (topicTo !== to) continue;
      amount += scaled(BigInt(log.data ?? "0x0"), input.token.decimals);
    }
    if (amount === 0) {
      return { found: true, amount: 0, from, blockNumber, confirmations, failed: true, reason: "No matching token transfer to the expected address" };
    }
  }

  return { found: true, amount, from, blockNumber, confirmations };
}

async function verifySolana(input: VerifyInput, url: string): Promise<VerifyResult> {
  const sig = input.txHash.trim();
  const to = input.toAddress.trim();

  const tx = await rpc<any>(url, "getTransaction", [
    sig,
    { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
  ]);
  if (!tx) return { found: false, amount: 0, from: null, blockNumber: null, confirmations: 0 };

  const slot = Number(tx.slot ?? 0);
  const head = await rpc<number>(url, "getSlot", [{ commitment: "confirmed" }]);
  const confirmations = Math.max(0, head - slot + 1);
  const keys: any[] = tx.transaction?.message?.accountKeys ?? [];
  const from = (keys.find((k) => k.signer)?.pubkey as string | undefined) ?? null;

  if (tx.meta?.err) {
    return { found: true, amount: 0, from, blockNumber: slot, confirmations, failed: true, reason: "Transaction failed on-chain" };
  }

  const mint = input.token.contract_address?.trim();
  let amount = 0;

  if (!mint) {
    const idx = keys.findIndex((k) => k.pubkey === to);
    if (idx < 0) {
      return { found: true, amount: 0, from, blockNumber: slot, confirmations, failed: true, reason: "Recipient address not present in transaction" };
    }
    const pre = BigInt(tx.meta?.preBalances?.[idx] ?? 0);
    const post = BigInt(tx.meta?.postBalances?.[idx] ?? 0);
    amount = scaled(post > pre ? post - pre : 0n, input.token.decimals);
  } else {
    const pre: any[] = tx.meta?.preTokenBalances ?? [];
    const post: any[] = tx.meta?.postTokenBalances ?? [];
    for (const p of post) {
      if (p.mint !== mint || p.owner !== to) continue;
      const before = pre.find((b) => b.accountIndex === p.accountIndex);
      const delta =
        BigInt(p.uiTokenAmount?.amount ?? "0") - BigInt(before?.uiTokenAmount?.amount ?? "0");
      if (delta > 0n) amount += scaled(delta, input.token.decimals);
    }
  }

  if (amount === 0) {
    return { found: true, amount: 0, from, blockNumber: slot, confirmations, failed: true, reason: "No matching transfer to the expected address" };
  }
  return { found: true, amount, from, blockNumber: slot, confirmations };
}

export async function verifyChainTransfer(input: VerifyInput): Promise<VerifyResult> {
  const url = rpcUrlFor(input.chain);
  if (!url) throw new Error(`No RPC endpoint configured for ${input.chain.key}`);
  if (input.chain.family === "solana") return verifySolana(input, url);
  return verifyEvm(input, url);
}

export function explorerTxUrl(explorer: string | null | undefined, hash: string) {
  if (!explorer) return null;
  const base = explorer.replace(/\/+$/, "");
  return `${base}/tx/${hash}`;
}
