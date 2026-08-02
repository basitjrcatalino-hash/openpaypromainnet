import type { PerpMarket } from "@/lib/perp";

/**
 * CoinMarketCap reference for Trade Spot / Perpetual Info.
 * @see https://coinmarketcap.com/currencies/bitcoin/
 * @see https://coinmarketcap.com/currencies/ethereum/
 * @see https://coinmarketcap.com/currencies/solana/
 * @see https://coinmarketcap.com/currencies/pi/
 */
export type CmcTradeInfo = {
  market: PerpMarket;
  slug: string;
  url: string;
  /** CoinMarketCap UCID */
  ucid: number;
  /** Typical CMC rank (live price still comes from market feeds) */
  rank: number;
  name: string;
  symbol: string;
  /** Short About blurb aligned with CoinMarketCap listings */
  about: string;
  tags: string[];
  website?: string;
  explorer?: string;
  maxSupply: number | null;
};

export const CMC_TRADE_INFO: Record<PerpMarket, CmcTradeInfo> = {
  BTC: {
    market: "BTC",
    slug: "bitcoin",
    url: "https://coinmarketcap.com/currencies/bitcoin/",
    ucid: 1,
    rank: 1,
    name: "Bitcoin",
    symbol: "BTC",
    about:
      "Bitcoin is the world’s first decentralized cryptocurrency, enabling peer-to-peer electronic cash without intermediaries. Secured by Proof of Work with a hard cap of 21 million coins, BTC is widely treated as digital gold and the reserve asset of crypto.",
    tags: ["Mineable", "PoW", "Store of Value", "Layer 1"],
    website: "https://bitcoin.org",
    explorer: "https://blockchain.info",
    maxSupply: 21_000_000,
  },
  ETH: {
    market: "ETH",
    slug: "ethereum",
    url: "https://coinmarketcap.com/currencies/ethereum/",
    ucid: 1027,
    rank: 2,
    name: "Ethereum",
    symbol: "ETH",
    about:
      "Ether (ETH) powers Ethereum — the leading smart-contract platform for DeFi, NFTs, and Layer-2 networks. After The Merge, Ethereum runs on Proof of Stake. ETH pays gas, secures the network via staking, and fuels the largest application ecosystem in crypto.",
    tags: ["Smart Contracts", "PoS", "Layer 1", "DeFi"],
    website: "https://ethereum.org",
    explorer: "https://etherscan.io",
    maxSupply: null,
  },
  SOL: {
    market: "SOL",
    slug: "solana",
    url: "https://coinmarketcap.com/currencies/solana/",
    ucid: 5426,
    rank: 7,
    name: "Solana",
    symbol: "SOL",
    about:
      "Solana is a high-throughput Layer 1 that combines Proof of History with Proof of Stake for fast finality and low fees. SOL pays network fees, funds smart-contract execution, and is the staking asset for validators across DeFi, NFTs, payments, and consumer apps.",
    tags: ["Solana Ecosystem", "Layer 1", "Smart Contracts"],
    website: "https://solana.com",
    explorer: "https://solscan.io",
    maxSupply: null,
  },
  PI: {
    market: "PI",
    slug: "pi",
    url: "https://coinmarketcap.com/currencies/pi/",
    ucid: 35697,
    rank: 55,
    name: "Pi",
    symbol: "PI",
    about:
      "Pi Network is a social cryptocurrency and mobile-first ecosystem designed for widespread accessibility. Users mine and transact PI with a mobile-friendly interface while supporting apps on its blockchain. Max supply is 100 billion tokens with allocations for community mining, foundation, liquidity, and the core team.",
    tags: ["Layer 1", "Mobile Mining"],
    website: "https://minepi.com",
    explorer: "https://blockexplorer.minepi.com",
    maxSupply: 100_000_000_000,
  },
};

export function cmcInfoForMarket(market: PerpMarket): CmcTradeInfo {
  return CMC_TRADE_INFO[market];
}

export function formatCompactUsd(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export function formatSupply(n: number, symbol: string): string {
  if (!(n > 0)) return "—";
  const body =
    n >= 1e9
      ? `${(n / 1e9).toFixed(2)}B`
      : n >= 1e6
        ? `${(n / 1e6).toFixed(2)}M`
        : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${body} ${symbol}`;
}
