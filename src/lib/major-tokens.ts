/**
 * Major tokens — Phantom-style catalog for BTC / ETH / SOL / PI.
 * Market stats refreshed from CoinGecko public API.
 * Refs:
 * - https://www.coingecko.com/en/coins/bitcoin
 * - https://www.coingecko.com/en/coins/ethereum
 * - https://www.coingecko.com/en/coins/solana
 * - https://www.coingecko.com/en/coins/pi-network
 */

export type MajorTokenId = "btc" | "eth" | "sol" | "pi";

export type MajorTokenDef = {
  id: MajorTokenId;
  name: string;
  symbol: string;
  network: string;
  category: string;
  logoUrl: string;
  website: string;
  twitter?: string;
  coingeckoId: string;
  /** MoonPay currency code when buyable; omit if not supported */
  moonpayCode?: string;
  createdLabel: string;
  createdAt: string;
  about: string;
  /** Native chain asset (no ERC-20 / SPL contract in OpenPay) */
  native: true;
};

export const MAJOR_TOKENS: Record<MajorTokenId, MajorTokenDef> = {
  btc: {
    id: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    network: "Bitcoin",
    category: "Layer 1",
    logoUrl: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    website: "https://bitcoin.org",
    twitter: "https://x.com/bitcoin",
    coingeckoId: "bitcoin",
    moonpayCode: "btc",
    createdLabel: "Jan 2009",
    createdAt: "2009-01-03T00:00:00.000Z",
    native: true,
    about:
      "Bitcoin is the world's first decentralized cryptocurrency, created in 2009 by the pseudonymous Satoshi Nakamoto. It enables peer-to-peer electronic cash without intermediaries, secured by Proof of Work on a public blockchain with a hard cap of 21 million coins. Often called digital gold, BTC is the reserve asset of crypto — with US spot ETFs since 2024 carrying institutional flows.",
  },
  eth: {
    id: "eth",
    name: "Ethereum",
    symbol: "ETH",
    network: "Ethereum",
    category: "Layer 1",
    logoUrl: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    website: "https://ethereum.org",
    twitter: "https://x.com/ethereum",
    coingeckoId: "ethereum",
    moonpayCode: "eth",
    createdLabel: "Jul 2015",
    createdAt: "2015-07-30T00:00:00.000Z",
    native: true,
    about:
      "Ether (ETH) is Ethereum's native token — the fuel for smart contracts, DeFi, NFTs, and Layer-2 networks like Base and Polygon. Proposed by Vitalik Buterin and launched in 2015, Ethereum moved to Proof of Stake in the 2022 Merge. ETH pays gas, secures the network via staking, and powers the largest application ecosystem in crypto.",
  },
  sol: {
    id: "sol",
    name: "Solana",
    symbol: "SOL",
    network: "Solana",
    category: "Layer 1",
    logoUrl: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    website: "https://solana.com",
    twitter: "https://x.com/solana",
    coingeckoId: "solana",
    moonpayCode: "sol",
    createdLabel: "Mar 2020",
    createdAt: "2020-03-16T00:00:00.000Z",
    native: true,
    about:
      "SOL is the native token of the Solana blockchain — a high-throughput Layer 1 launched in 2020. Proof of History plus Proof of Stake delivers fast finality and sub-cent fees. SOL pays every network fee, funds smart-contract execution, and is the staking asset for validators. Solana hosts a major ecosystem across DeFi, NFTs, payments, and consumer apps.",
  },
  pi: {
    id: "pi",
    name: "Pi Network",
    symbol: "PI",
    network: "Pi Network",
    category: "Layer 1",
    logoUrl: "https://coin-images.coingecko.com/coins/images/54342/large/pi_network.jpg?1739347576",
    website: "https://minepi.com/",
    twitter: "https://x.com/PiCoreTeam",
    coingeckoId: "pi-network",
    // Not listed on MoonPay — buy opens with a notice on asset detail
    createdLabel: "Mar 2019",
    createdAt: "2019-03-14T00:00:00.000Z",
    native: true,
    about:
      "Pi Network is a mobile-first cryptocurrency project that lets users mine PI from their phones with a social consensus model. The open mainnet listed PI for trading in 2025. PI is the native asset of the Pi blockchain — used for transfers, ecosystem apps, and network participation. Market data is sourced from CoinGecko.",
  },
};

export const MAJOR_TOKEN_IDS = Object.keys(MAJOR_TOKENS) as MajorTokenId[];

export function isMajorTokenId(id: string): id is MajorTokenId {
  return id === "btc" || id === "eth" || id === "sol" || id === "pi";
}

export function getMajorToken(id: string): MajorTokenDef | null {
  if (!isMajorTokenId(id)) return null;
  return MAJOR_TOKENS[id];
}

/** Symbols that should be hidden from DB list when majors are pinned. */
export const MAJOR_SYMBOLS = new Set([
  "BTC",
  "ETH",
  "SOL",
  "PI",
  "BITCOIN",
  "ETHEREUM",
  "SOLANA",
  "PI NETWORK",
  "PINETWORK",
]);

export type MajorMarketSnapshot = {
  id: MajorTokenId;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  totalSupply: number;
  circulatingSupply: number;
  ath: number;
  atl: number;
  athDate: string | null;
  atlDate: string | null;
  sparkline: number[];
};

type CoinGeckoMarketRow = {
  id: string;
  current_price?: number;
  price_change_percentage_24h?: number;
  market_cap?: number;
  total_volume?: number;
  total_supply?: number | null;
  circulating_supply?: number | null;
  ath?: number;
  atl?: number;
  ath_date?: string | null;
  atl_date?: string | null;
  sparkline_in_7d?: { price?: number[] };
};

const CG_ID_TO_MAJOR: Record<string, MajorTokenId> = {
  bitcoin: "btc",
  ethereum: "eth",
  solana: "sol",
  "pi-network": "pi",
};

/** Fallback static values if CoinGecko is unreachable. */
const FALLBACK_MARKET: Record<MajorTokenId, Omit<MajorMarketSnapshot, "id" | "sparkline">> = {
  btc: {
    price: 65000,
    change24h: 0,
    marketCap: 1.3e12,
    volume24h: 2.5e10,
    totalSupply: 21_000_000,
    circulatingSupply: 20_060_000,
    ath: 126080,
    atl: 67.81,
    athDate: "2025-10-01T00:00:00.000Z",
    atlDate: "2013-07-01T00:00:00.000Z",
  },
  eth: {
    price: 1920,
    change24h: 0,
    marketCap: 2.32e11,
    volume24h: 4.09e8,
    totalSupply: 120_680_000,
    circulatingSupply: 120_680_000,
    ath: 4946,
    atl: 0.43,
    athDate: "2025-08-01T00:00:00.000Z",
    atlDate: "2015-10-01T00:00:00.000Z",
  },
  sol: {
    price: 74,
    change24h: 0,
    marketCap: 4.3e10,
    volume24h: 5.7e9,
    totalSupply: 631_250_000,
    circulatingSupply: 579_590_000,
    ath: 293.31,
    atl: 0.5,
    athDate: "2025-01-01T00:00:00.000Z",
    atlDate: "2020-05-01T00:00:00.000Z",
  },
  pi: {
    price: 0.079,
    change24h: 0,
    marketCap: 8.66e8,
    volume24h: 1.13e7,
    totalSupply: 16_833_495_111,
    circulatingSupply: 10_941_771_822,
    ath: 2.99,
    atl: 0.070586,
    athDate: "2025-02-26T08:41:03.000Z",
    atlDate: "2026-07-14T02:37:30.000Z",
  },
};

export async function fetchMajorMarkets(): Promise<MajorMarketSnapshot[]> {
  const ids = MAJOR_TOKEN_IDS.map((id) => MAJOR_TOKENS[id].coingeckoId).join(",");
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const rows = (await res.json()) as CoinGeckoMarketRow[];
    const byCg = new Map(rows.map((r) => [r.id, r]));

    return MAJOR_TOKEN_IDS.map((id) => {
      const def = MAJOR_TOKENS[id];
      const row = byCg.get(def.coingeckoId);
      const fb = FALLBACK_MARKET[id];
      if (!row) {
        return { id, ...fb, sparkline: [] };
      }
      return {
        id,
        price: Number(row.current_price ?? fb.price),
        change24h: Number(row.price_change_percentage_24h ?? fb.change24h),
        marketCap: Number(row.market_cap ?? fb.marketCap),
        volume24h: Number(row.total_volume ?? fb.volume24h),
        totalSupply: Number(row.total_supply ?? fb.totalSupply),
        circulatingSupply: Number(row.circulating_supply ?? fb.circulatingSupply),
        ath: Number(row.ath ?? fb.ath),
        atl: Number(row.atl ?? fb.atl),
        athDate: row.ath_date ?? fb.athDate,
        atlDate: row.atl_date ?? fb.atlDate,
        sparkline: Array.isArray(row.sparkline_in_7d?.price) ? row.sparkline_in_7d!.price! : [],
      };
    });
  } catch {
    return MAJOR_TOKEN_IDS.map((id) => ({ id, ...FALLBACK_MARKET[id], sparkline: [] }));
  }
}

export function majorMarketById(
  markets: MajorMarketSnapshot[] | undefined,
  id: MajorTokenId,
): MajorMarketSnapshot {
  const found = markets?.find((m) => m.id === id);
  if (found) return found;
  return { id, ...FALLBACK_MARKET[id], sparkline: [] };
}

export { CG_ID_TO_MAJOR };
