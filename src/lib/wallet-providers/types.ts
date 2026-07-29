/**
 * Wallet provider abstraction — future-ready for Circle, Dynamic, Privy,
 * Turnkey, Fireblocks, BitGo, Coinbase CDP, etc.
 *
 * UI and hooks depend only on this interface; swap providers without UI changes.
 */

export type WalletProviderId =
  | "circle"
  | "dynamic"
  | "privy"
  | "turnkey"
  | "fireblocks"
  | "bitgo"
  | "coinbase"
  | "openpay";

export type BlockchainId =
  | "ETH"
  | "ETH-SEPOLIA"
  | "MATIC"
  | "MATIC-AMOY"
  | "SOL"
  | "SOL-DEVNET"
  | "BASE"
  | "BASE-SEPOLIA"
  | "ARB"
  | "ARB-SEPOLIA"
  | string;

export type CryptoWalletRecord = {
  id: string;
  user_id: string;
  provider: WalletProviderId;
  circle_wallet_id: string | null;
  wallet_set_id: string | null;
  blockchain: BlockchainId;
  address: string;
  status: "active" | "creating" | "failed" | "archived";
  created_at: string;
};

export type TokenBalance = {
  token: string;
  symbol: string;
  amount: string;
  decimals?: number;
  tokenAddress?: string | null;
  tokenId?: string | null;
};

export type CryptoTransactionRecord = {
  id: string;
  user_id: string;
  wallet_id: string;
  tx_hash: string | null;
  token: string;
  amount: number;
  network: string;
  status: string;
  direction: "deposit" | "withdraw";
  provider_tx_id?: string | null;
  created_at: string;
};

export type CreateWalletInput = {
  userId: string;
  blockchain?: BlockchainId;
  /** Idempotency key — use stable user-scoped value to prevent duplicates */
  idempotencyKey: string;
};

export type SendTransactionInput = {
  walletId: string;
  /** Circle / provider wallet id */
  providerWalletId: string;
  destinationAddress: string;
  tokenAddress: string;
  amount: string;
  blockchain: BlockchainId;
};

/**
 * Unified wallet provider contract.
 * Implement this for each custody / embedded-wallet vendor.
 */
export interface WalletProvider {
  readonly id: WalletProviderId;

  /** Create a new wallet for a user (or return existing). */
  createWallet(input: CreateWalletInput): Promise<{
    providerWalletId: string;
    walletSetId: string;
    address: string;
    blockchain: BlockchainId;
  }>;

  /** Resolve address for a provider wallet id. */
  getAddress(providerWalletId: string): Promise<string>;

  /** Token balances for a provider wallet. */
  getBalance(providerWalletId: string): Promise<TokenBalance[]>;

  /** Recent on-chain / provider transactions. */
  getTransactions(providerWalletId: string): Promise<
    Array<{
      id: string;
      txHash: string | null;
      amount: string;
      token: string;
      status: string;
      direction: "deposit" | "withdraw";
      createdAt: string;
      network: string;
    }>
  >;

  /** Submit an outbound transfer. */
  sendTransaction(input: SendTransactionInput): Promise<{ providerTxId: string }>;
}
