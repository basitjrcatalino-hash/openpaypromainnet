/**
 * Phantom-listed Solana tokens (discover / chart / live chat).
 * Not OpenPay ledger majors — no wallets.*_balance columns.
 *
 * Mints verified from Phantom token pages:
 * - HYPE  https://phantom.com/tokens/solana/98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g
 * - ZEC   https://phantom.com/tokens/solana/A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS
 * - TSLAx https://phantom.com/tokens/solana/XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB
 * - NFLXx https://phantom.com/tokens/solana/XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL
 * - GOOGLx https://phantom.com/tokens/solana/XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN
 */

export type ListedSolanaTokenId = "hype" | "zec" | "tslax" | "nflxx" | "googlx";

export type ListedSolanaTokenDef = {
  id: ListedSolanaTokenId;
  name: string;
  symbol: string;
  network: "Solana";
  category: string;
  logoUrl: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  mintAddress: string;
  phantomUrl: string;
  /** Optional CoinGecko id for native price proxy when DexScreener is thin */
  coingeckoId?: string;
  createdLabel: string;
  createdAt: string;
  about: string;
};

export const LISTED_SOLANA_TOKENS: Record<ListedSolanaTokenId, ListedSolanaTokenDef> = {
  hype: {
    id: "hype",
    name: "HYPE",
    symbol: "HYPE",
    network: "Solana",
    category: "Bridged asset",
    logoUrl: "https://assets.coingecko.com/coins/images/50882/large/hyperliquid.jpg",
    website: "https://hyperfoundation.org",
    mintAddress: "98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g",
    phantomUrl:
      "https://phantom.com/tokens/solana/98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g",
    coingeckoId: "hyperliquid",
    createdLabel: "Oct 2025",
    createdAt: "2025-10-01T00:00:00.000Z",
    about:
      "HYPE on Solana is a bridged representation of Hyperliquid’s native gas/governance token. Price tracks native HYPE via arbitrage; verify mint 98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g before trading. Bridge and redemption terms are independent of OpenPay Pro.",
  },
  zec: {
    id: "zec",
    name: "Zcash",
    symbol: "ZEC",
    network: "Solana",
    category: "Privacy",
    logoUrl: "https://assets.coingecko.com/coins/images/486/large/circle-zcash-color.png",
    website: "https://z.cash",
    mintAddress: "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS",
    phantomUrl:
      "https://phantom.com/tokens/solana/A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS",
    coingeckoId: "zcash",
    createdLabel: "Oct 2025",
    createdAt: "2025-10-01T00:00:00.000Z",
    about:
      "ZEC on Solana is a Phantom-listed Solana representation of Zcash. Always confirm mint A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS — same-ticker fakes exist. OpenPay Pro surfaces market data for discovery and live chat.",
  },
  tslax: {
    id: "tslax",
    name: "Tesla xStock",
    symbol: "TSLAx",
    network: "Solana",
    category: "xStock",
    logoUrl:
      "https://dd.dexscreener.com/ds-data/tokens/solana/XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB.png",
    website: "https://phantom.com/tokens/solana/XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    mintAddress: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    phantomUrl:
      "https://phantom.com/tokens/solana/XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    createdLabel: "Jun 2025",
    createdAt: "2025-06-01T00:00:00.000Z",
    about:
      "Tesla xStock (TSLAx) is a Solana tokenized equity product listed on Phantom. Mint XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB. Not Tesla stock custody — verify issuer terms before buying.",
  },
  nflxx: {
    id: "nflxx",
    name: "Netflix xStock",
    symbol: "NFLXx",
    network: "Solana",
    category: "xStock",
    logoUrl:
      "https://dd.dexscreener.com/ds-data/tokens/solana/XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL.png",
    website: "https://phantom.com/tokens/solana/XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL",
    mintAddress: "XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL",
    phantomUrl:
      "https://phantom.com/tokens/solana/XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL",
    createdLabel: "Jun 2025",
    createdAt: "2025-06-01T00:00:00.000Z",
    about:
      "Netflix xStock (NFLXx) is a Solana tokenized equity product listed on Phantom. Mint XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL. Verify issuer and liquidity before trading.",
  },
  googlx: {
    id: "googlx",
    name: "Alphabet xStock",
    symbol: "GOOGLx",
    network: "Solana",
    category: "xStock",
    logoUrl:
      "https://dd.dexscreener.com/ds-data/tokens/solana/XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN.png",
    website: "https://phantom.com/tokens/solana/XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
    mintAddress: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
    phantomUrl:
      "https://phantom.com/tokens/solana/XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
    createdLabel: "Jun 2025",
    createdAt: "2025-06-01T00:00:00.000Z",
    about:
      "Alphabet xStock (GOOGLx) is a Solana tokenized equity product listed on Phantom. Mint XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN. Verify issuer and mint before trading.",
  },
};

export const LISTED_SOLANA_TOKEN_IDS = Object.keys(
  LISTED_SOLANA_TOKENS,
) as ListedSolanaTokenId[];

export const LISTED_SOLANA_SYMBOLS = new Set(
  LISTED_SOLANA_TOKEN_IDS.flatMap((id) => {
    const t = LISTED_SOLANA_TOKENS[id];
    return [t.symbol.toUpperCase(), t.name.toUpperCase()];
  }),
);

export function isListedSolanaTokenId(id: string): id is ListedSolanaTokenId {
  return Object.prototype.hasOwnProperty.call(LISTED_SOLANA_TOKENS, id.toLowerCase());
}

export function getListedSolanaToken(id: string): ListedSolanaTokenDef | null {
  const key = id.toLowerCase();
  if (!isListedSolanaTokenId(key)) return null;
  return LISTED_SOLANA_TOKENS[key];
}

export type ListedSolanaMarketSnapshot = {
  id: ListedSolanaTokenId;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  logoUrl: string | null;
  sparkline: number[];
};

const FALLBACK: Record<
  ListedSolanaTokenId,
  Omit<ListedSolanaMarketSnapshot, "id" | "sparkline" | "logoUrl">
> = {
  hype: { price: 55, change24h: 0, marketCap: 3.8e7, volume24h: 5.1e6, liquidity: 1.2e7 },
  zec: { price: 450, change24h: 0, marketCap: 4.0e7, volume24h: 5.7e6, liquidity: 7.8e6 },
  tslax: { price: 350, change24h: 0, marketCap: 5.8e7, volume24h: 2.96e5, liquidity: 3.3e6 },
  nflxx: { price: 70, change24h: 0, marketCap: 1.1e7, volume24h: 31, liquidity: 1300 },
  googlx: { price: 200, change24h: 0, marketCap: 2.9e7, volume24h: 7.5e4, liquidity: 6.95e5 },
};

type DexPair = {
  priceUsd?: string;
  priceChange?: { h24?: number };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  fdv?: number;
  marketCap?: number;
  info?: { imageUrl?: string };
  baseToken?: { address?: string };
};

/** Live markets from DexScreener by mint; CoinGecko proxy when available. */
export async function fetchListedSolanaMarkets(): Promise<ListedSolanaMarketSnapshot[]> {
  const mints = LISTED_SOLANA_TOKEN_IDS.map((id) => LISTED_SOLANA_TOKENS[id].mintAddress).join(",");
  let byMint = new Map<string, DexPair>();

  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints}`, {
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const json = (await res.json()) as { pairs?: DexPair[] };
      const pairs = json.pairs ?? [];
      // Prefer highest-liquidity pair per mint
      for (const p of pairs) {
        const mint = String(p.baseToken?.address ?? "").toLowerCase();
        if (!mint) continue;
        const prev = byMint.get(mint);
        const liq = Number(p.liquidity?.usd ?? 0);
        const prevLiq = Number(prev?.liquidity?.usd ?? 0);
        if (!prev || liq > prevLiq) byMint.set(mint, p);
      }
    }
  } catch {
    /* fall through */
  }

  // Optional CoinGecko fill for HYPE / ZEC
  let cgById: Record<string, { price: number; change: number; mcap: number; vol: number }> = {};
  try {
    const ids = LISTED_SOLANA_TOKEN_IDS.map((id) => LISTED_SOLANA_TOKENS[id].coingeckoId)
      .filter(Boolean)
      .join(",");
    if (ids) {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`,
        { headers: { accept: "application/json" } },
      );
      if (res.ok) {
        const rows = (await res.json()) as Array<{
          id: string;
          current_price?: number;
          price_change_percentage_24h?: number;
          market_cap?: number;
          total_volume?: number;
        }>;
        for (const r of rows) {
          cgById[r.id] = {
            price: Number(r.current_price ?? 0),
            change: Number(r.price_change_percentage_24h ?? 0),
            mcap: Number(r.market_cap ?? 0),
            vol: Number(r.total_volume ?? 0),
          };
        }
      }
    }
  } catch {
    /* ignore */
  }

  return LISTED_SOLANA_TOKEN_IDS.map((id) => {
    const def = LISTED_SOLANA_TOKENS[id];
    const fb = FALLBACK[id];
    const pair = byMint.get(def.mintAddress.toLowerCase());
    const cg = def.coingeckoId ? cgById[def.coingeckoId] : undefined;
    const price =
      Number(pair?.priceUsd ?? 0) ||
      cg?.price ||
      fb.price;
    const change24h =
      (pair?.priceChange?.h24 != null ? Number(pair.priceChange.h24) : null) ??
      cg?.change ??
      fb.change24h;
    const marketCap =
      Number(pair?.marketCap ?? pair?.fdv ?? 0) || cg?.mcap || fb.marketCap;
    const volume24h = Number(pair?.volume?.h24 ?? 0) || cg?.vol || fb.volume24h;
    const liquidity = Number(pair?.liquidity?.usd ?? 0) || fb.liquidity;
    const logoUrl = pair?.info?.imageUrl || def.logoUrl;

    return {
      id,
      price,
      change24h,
      marketCap,
      volume24h,
      liquidity,
      logoUrl,
      sparkline: [],
    };
  });
}

export function listedSolanaMarketById(
  markets: ListedSolanaMarketSnapshot[] | undefined,
  id: ListedSolanaTokenId,
): ListedSolanaMarketSnapshot {
  const found = markets?.find((m) => m.id === id);
  if (found) return found;
  const fb = FALLBACK[id];
  return { id, ...fb, logoUrl: LISTED_SOLANA_TOKENS[id].logoUrl, sparkline: [] };
}
