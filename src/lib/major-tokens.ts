/**
 * Major tokens — Phantom-style catalog for BTC / ETH / SOL / PI + USD stables / EURC.
 * Market stats refreshed from CoinGecko public API.
 *
 * Stablecoin Phantom refs:
 * - USDC  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
 * - USDT  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
 * - PYUSD 2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo
 * - USDG  2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH
 * - USD1  USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB
 * - CASH  CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH
 * - EURC  0x1abaea1f7c830bd89acc67ec4af516284b1bc33c (Ethereum)
 */

export type MajorTokenId =
  | "btc"
  | "eth"
  | "sol"
  | "pi"
  | "usdc"
  | "usdt"
  | "pyusd"
  | "usdg"
  | "usd1"
  | "cash"
  | "eurc";

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
  /** Native chain asset (no ERC-20 / SPL contract) */
  native: boolean;
  /** Verified Solana SPL mint when applicable */
  mintAddress?: string;
  /** Verified EVM contract when applicable */
  contractAddress?: string;
  /** Phantom token page for mint verification */
  phantomUrl?: string;
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
    createdLabel: "Mar 2019",
    createdAt: "2019-03-14T00:00:00.000Z",
    native: true,
    about:
      "Pi Network is a mobile-first cryptocurrency project that lets users mine PI from their phones with a social consensus model. The open mainnet listed PI for trading in 2025. PI is the native asset of the Pi blockchain — used for transfers, ecosystem apps, and network participation. Market data is sourced from CoinGecko.",
  },
  usdc: {
    id: "usdc",
    name: "USD Coin",
    symbol: "USDC",
    network: "Solana",
    category: "Stablecoin",
    logoUrl: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
    website: "https://www.circle.com/usdc",
    twitter: "https://x.com/circle",
    coingeckoId: "usd-coin",
    moonpayCode: "usdc",
    createdLabel: "Sep 2018",
    createdAt: "2018-09-26T00:00:00.000Z",
    native: false,
    mintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    phantomUrl:
      "https://phantom.com/tokens/solana/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    about:
      "USDC is a fully reserved USD stablecoin issued by Circle, natively available on Solana as an SPL token. OpenPay Pro credits USDC to your custodial ledger at market price. Always verify the Solana mint EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v before accepting external transfers — counterfeit look-alikes exist.",
  },
  usdt: {
    id: "usdt",
    name: "Tether",
    symbol: "USDT",
    network: "Solana",
    category: "Stablecoin",
    logoUrl: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
    website: "https://tether.to",
    twitter: "https://x.com/Tether_to",
    coingeckoId: "tether",
    moonpayCode: "usdt",
    createdLabel: "Oct 2014",
    createdAt: "2014-10-06T00:00:00.000Z",
    native: false,
    mintAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    phantomUrl:
      "https://phantom.com/tokens/solana/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    about:
      "USDT (Tether) is the largest USD-pegged stablecoin, issued by Tether Limited. On Solana it runs as a native SPL token. OpenPay Pro credits USDT to your custodial ledger at market price. Confirm the mint Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB before accepting external USDT — fake stables with similar names circulate on Solana.",
  },
  pyusd: {
    id: "pyusd",
    name: "PayPal USD",
    symbol: "PYUSD",
    network: "Solana",
    category: "Stablecoin",
    logoUrl: "https://assets.coingecko.com/coins/images/31212/large/PYUSD.png",
    website: "https://www.paypal.com/pyusd",
    twitter: "https://x.com/PayPal",
    coingeckoId: "paypal-usd",
    createdLabel: "Aug 2023",
    createdAt: "2023-08-07T00:00:00.000Z",
    native: false,
    mintAddress: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
    phantomUrl:
      "https://phantom.com/tokens/solana/2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
    about:
      "PayPal USD (PYUSD) is a USD stablecoin issued by Paxos Trust Company, 100% backed by U.S. dollar deposits, short-term Treasuries, and cash equivalents, redeemable 1:1 for USD. On Solana verify mint 2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo before accepting transfers.",
  },
  usdg: {
    id: "usdg",
    name: "Global Dollar",
    symbol: "USDG",
    network: "Solana",
    category: "Stablecoin",
    logoUrl: "https://assets.coingecko.com/coins/images/52578/large/usdg.png",
    website: "https://www.globaldollar.com",
    twitter: "https://x.com/GlobalDollarUSD",
    coingeckoId: "global-dollar",
    createdLabel: "Jan 2025",
    createdAt: "2025-01-01T00:00:00.000Z",
    native: false,
    mintAddress: "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH",
    phantomUrl:
      "https://phantom.com/tokens/solana/2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH",
    about:
      "USDG (Global Dollar) is a fully backed USD stablecoin issued by Paxos, redeemable 1:1 for U.S. dollars and backed by dollar deposits, short-term Treasuries, and cash equivalents. On Solana verify mint 2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH.",
  },
  usd1: {
    id: "usd1",
    name: "World Liberty Financial USD",
    symbol: "USD1",
    network: "Solana",
    category: "Stablecoin",
    logoUrl: "https://assets.coingecko.com/coins/images/54693/large/USD1.png",
    website: "https://www.worldlibertyfinancial.com",
    twitter: "https://x.com/worldlibertyfi",
    coingeckoId: "usd1-wlfi",
    createdLabel: "Jul 2025",
    createdAt: "2025-07-01T00:00:00.000Z",
    native: false,
    mintAddress: "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB",
    phantomUrl:
      "https://phantom.com/tokens/solana/USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB",
    about:
      "USD1 is the World Liberty Financial USD stablecoin — designed to stay stable, secure, and transparent. OpenPay Pro credits USD1 on your custodial ledger at market price. Verify Solana mint USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB before accepting external transfers.",
  },
  cash: {
    id: "cash",
    name: "CASH",
    symbol: "CASH",
    network: "Solana",
    category: "Stablecoin",
    logoUrl: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
    website: "https://phantom.com/cash",
    twitter: "https://x.com/phantom",
    /** Not always listed on CoinGecko — fallback peg $1 used when markets miss. */
    coingeckoId: "phantom-cash",
    createdLabel: "Aug 2025",
    createdAt: "2025-08-01T00:00:00.000Z",
    native: false,
    mintAddress: "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH",
    phantomUrl:
      "https://phantom.com/tokens/solana/CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH",
    about:
      "CASH is Phantom's USD-pegged stablecoin on Solana, designed with Open Issuance by Bridge and Stripe for real-world utility. One CASH targets one U.S. dollar. Always verify mint CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH — look-alike stables are common.",
  },
  eurc: {
    id: "eurc",
    name: "EURC",
    symbol: "EURC",
    network: "Ethereum",
    category: "Stablecoin",
    logoUrl: "https://assets.coingecko.com/coins/images/26045/large/euro-coin.png",
    website: "https://www.circle.com/eurc",
    twitter: "https://x.com/circle",
    coingeckoId: "euro-coin",
    createdLabel: "Jun 2022",
    createdAt: "2022-06-01T00:00:00.000Z",
    native: false,
    contractAddress: "0x1abaea1f7c830bd89acc67ec4af516284b1bc33c",
    phantomUrl:
      "https://phantom.com/tokens/ethereum/0x1abaea1f7c830bd89acc67ec4af516284b1bc33c",
    about:
      "EURC (Euro Coin) is a euro-backed stablecoin issued by Circle under the same reserve model as USDC — designed to be redeemable 1:1 for euros held in euro-denominated accounts. On Ethereum verify contract 0x1abaea1f7c830bd89acc67ec4af516284b1bc33c. OpenPay Pro marks EURC to USD via live market price when buying with OUSD.",
  },
};

export const MAJOR_TOKEN_IDS = Object.keys(MAJOR_TOKENS) as MajorTokenId[];

export function isMajorTokenId(id: string): id is MajorTokenId {
  return Object.prototype.hasOwnProperty.call(MAJOR_TOKENS, id);
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
  "USDC",
  "USDT",
  "PYUSD",
  "USDG",
  "USD1",
  "CASH",
  "EURC",
  "BITCOIN",
  "ETHEREUM",
  "SOLANA",
  "PI NETWORK",
  "PINETWORK",
  "USD COIN",
  "USDCOIN",
  "TETHER",
  "PAYPAL USD",
  "GLOBAL DOLLAR",
  "WORLD LIBERTY FINANCIAL USD",
  "EURO COIN",
  "EUROC",
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
  "usd-coin": "usdc",
  tether: "usdt",
  "paypal-usd": "pyusd",
  "global-dollar": "usdg",
  "usd1-wlfi": "usd1",
  "euro-coin": "eurc",
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
  usdc: {
    price: 1,
    change24h: 0,
    marketCap: 7.5e10,
    volume24h: 1.3e10,
    totalSupply: 7.45e10,
    circulatingSupply: 7.45e10,
    ath: 1.17,
    atl: 0.877647,
    athDate: "2019-05-08T00:00:00.000Z",
    atlDate: "2023-03-11T00:00:00.000Z",
  },
  usdt: {
    price: 1,
    change24h: 0,
    marketCap: 1.6e11,
    volume24h: 8e10,
    totalSupply: 1.6e11,
    circulatingSupply: 1.6e11,
    ath: 1.32,
    atl: 0.572521,
    athDate: "2018-07-24T00:00:00.000Z",
    atlDate: "2015-03-02T00:00:00.000Z",
  },
  pyusd: {
    price: 1,
    change24h: 0,
    marketCap: 6.8e8,
    volume24h: 2.9e7,
    totalSupply: 6.8e8,
    circulatingSupply: 6.8e8,
    ath: 1.11,
    atl: 0.93,
    athDate: "2024-01-01T00:00:00.000Z",
    atlDate: "2023-08-01T00:00:00.000Z",
  },
  usdg: {
    price: 1,
    change24h: 0,
    marketCap: 6.33e8,
    volume24h: 4.3e7,
    totalSupply: 6.33e8,
    circulatingSupply: 6.33e8,
    ath: 1.0,
    atl: 1.0,
    athDate: "2025-01-01T00:00:00.000Z",
    atlDate: "2025-01-01T00:00:00.000Z",
  },
  usd1: {
    price: 1,
    change24h: 0,
    marketCap: 1e9,
    volume24h: 3.1e7,
    totalSupply: 1.02e9,
    circulatingSupply: 1.02e9,
    ath: 1.0,
    atl: 1.0,
    athDate: "2025-07-01T00:00:00.000Z",
    atlDate: "2025-07-01T00:00:00.000Z",
  },
  cash: {
    price: 1,
    change24h: 0,
    marketCap: 1.23e8,
    volume24h: 8e6,
    totalSupply: 1.23e8,
    circulatingSupply: 1.23e8,
    ath: 1.0,
    atl: 1.0,
    athDate: "2025-08-01T00:00:00.000Z",
    atlDate: "2025-08-01T00:00:00.000Z",
  },
  eurc: {
    price: 1.08,
    change24h: 0,
    marketCap: 3.32e8,
    volume24h: 5.4e6,
    totalSupply: 2.9e8,
    circulatingSupply: 2.9e8,
    ath: 1.18,
    atl: 1.03,
    athDate: "2023-01-01T00:00:00.000Z",
    atlDate: "2022-06-01T00:00:00.000Z",
  },
};

export async function fetchMajorMarkets(): Promise<MajorMarketSnapshot[]> {
  const ids = MAJOR_TOKEN_IDS.map((id) => MAJOR_TOKENS[id].coingeckoId)
    .filter((cg) => cg !== "phantom-cash")
    .join(",");
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const rows = (await res.json()) as CoinGeckoMarketRow[];
    const byCg = new Map(rows.map((r) => [r.id, r]));

    const markets = MAJOR_TOKEN_IDS.map((id) => {
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

    const pi = markets.find((m) => m.id === "pi");
    if (pi && pi.price > 0) {
      void import("@/lib/ledger-majors").then((m) => m.setCachedPiUsdPrice(pi.price));
    }

    return markets;
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
