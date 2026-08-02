import type { PerpMarket } from "@/lib/perp";

/**
 * CoinMarketCap reference for Trade Spot / Perpetual Info tabs
 * (Overview · News · Analysis).
 * @see https://coinmarketcap.com/currencies/bitcoin/
 * @see https://coinmarketcap.com/currencies/ethereum/
 * @see https://coinmarketcap.com/currencies/solana/
 * @see https://coinmarketcap.com/currencies/pi/
 */
export type CmcNewsItem = {
  title: string;
  summary: string;
  url: string;
  source: string;
};

export type CmcAnalysisPoint = {
  title: string;
  detail: string;
};

export type CmcTradeInfo = {
  market: PerpMarket;
  slug: string;
  url: string;
  newsUrl: string;
  analysisUrl: string;
  /** CoinMarketCap UCID */
  ucid: number;
  /** Typical CMC rank (live price still comes from market feeds) */
  rank: number;
  name: string;
  symbol: string;
  /** Short About blurb aligned with CoinMarketCap listings */
  about: string;
  /** Extra CMC “What is / founders / unique” style bullets for Overview */
  overviewFacts: { label: string; value: string }[];
  tags: string[];
  website?: string;
  explorer?: string;
  whitepaper?: string;
  maxSupply: number | null;
  /** Curated CMC / CMC Academy headlines for News tab */
  news: CmcNewsItem[];
  /** CMC-style analysis framing for Analysis tab */
  analysis: {
    summary: string;
    points: CmcAnalysisPoint[];
    spotNote: string;
    perpNote: string;
  };
};

export const CMC_TRADE_INFO: Record<PerpMarket, CmcTradeInfo> = {
  BTC: {
    market: "BTC",
    slug: "bitcoin",
    url: "https://coinmarketcap.com/currencies/bitcoin/",
    newsUrl: "https://coinmarketcap.com/currencies/bitcoin/#news",
    analysisUrl: "https://coinmarketcap.com/currencies/bitcoin/",
    ucid: 1,
    rank: 1,
    name: "Bitcoin",
    symbol: "BTC",
    about:
      "Bitcoin is a decentralized cryptocurrency originally described in a 2008 whitepaper by Satoshi Nakamoto and launched in January 2009. It is a peer-to-peer online currency — transactions happen between network participants without an intermediary. BTC is widely treated as digital gold and the reserve asset of crypto, secured by Proof of Work with a hard cap of 21 million coins.",
    overviewFacts: [
      { label: "Consensus", value: "Proof of Work (SHA-256)" },
      { label: "Launch", value: "January 2009" },
      { label: "Max supply", value: "21,000,000 BTC" },
      { label: "Founder", value: "Satoshi Nakamoto" },
      { label: "UCID", value: "1" },
      { label: "Category", value: "Store of Value · Layer 1" },
    ],
    tags: ["Mineable", "PoW", "Store of Value", "Layer 1", "Bitcoin Ecosystem"],
    website: "https://bitcoin.org",
    explorer: "https://blockchain.info",
    whitepaper: "https://bitcoin.org/bitcoin.pdf",
    maxSupply: 21_000_000,
    news: [
      {
        title: "Bitcoin, Ethereum Soar as CLARITY Act Edges Closer",
        summary:
          "CMC Academy coverage of BTC/ETH moves as US market-structure legislation and ETF flows stay in focus.",
        url: "https://coinmarketcap.com/academy/article/btc-eth-soar-clarity-act-fed-hike-end-rally",
        source: "CoinMarketCap Academy",
      },
      {
        title: "Bitcoin Price Stuck Trading Sideways — Is $80K Ahead?",
        summary:
          "Range-bound BTC action, futures liquidations, and spot ETF flow context from CoinMarketCap.",
        url: "https://coinmarketcap.com/academy/article/bitcoin-stuck-sideways-trading-80k-rally",
        source: "CoinMarketCap Academy",
      },
      {
        title: "CMC Market Pulse — Crypto Market Seeks Clarity",
        summary:
          "Weekly market pulse covering BTC leadership, liquidations, funding, and regulatory catalysts.",
        url: "https://coinmarketcap.com/academy/article/cmc-market-pulse-crypto-market-seeks-clarity",
        source: "CoinMarketCap Academy",
      },
    ],
    analysis: {
      summary:
        "On CoinMarketCap, Bitcoin remains the #1 crypto by market cap. Traders typically watch 24h high/low, Vol/Mkt Cap, circulating vs max supply (~95%+ mined), and distance from ATH. Institutional ETF flows and futures open interest often drive short-term Spot and Perpetual moves.",
      points: [
        {
          title: "Supply & scarcity",
          detail:
            "Hard cap 21M BTC; new issuance halves roughly every four years. Circulating supply is nearly all of max supply on CMC stats.",
        },
        {
          title: "Price performance lens",
          detail:
            "CMC highlights 24h range, ATH/ATL distance, and dominance vs the broader market — useful for Spot sizing and Perp risk.",
        },
        {
          title: "Derivatives context",
          detail:
            "Funding, liquidations, and OI on perpetual markets can amplify Spot price moves; watch mark vs index on Perps.",
        },
      ],
      spotNote:
        "Spot BTC/USDT settles against live mark using Funding balances. Long-term holders often track CMC circulating supply and ATH drawdown.",
      perpNote:
        "BTCUSDT Perpetual uses mark price and funding. Leverage amplifies both gains and liquidation risk versus Spot.",
    },
  },
  ETH: {
    market: "ETH",
    slug: "ethereum",
    url: "https://coinmarketcap.com/currencies/ethereum/",
    newsUrl: "https://coinmarketcap.com/currencies/ethereum/#news",
    analysisUrl: "https://coinmarketcap.com/currencies/ethereum/",
    ucid: 1027,
    rank: 2,
    name: "Ethereum",
    symbol: "ETH",
    about:
      "Ether (ETH) powers Ethereum — the leading smart-contract platform for DeFi, NFTs, and Layer-2 networks. After The Merge, Ethereum runs on Proof of Stake. ETH pays gas, secures the network via staking, and fuels the largest application ecosystem in crypto. CoinMarketCap ranks ETH #2 by market capitalization.",
    overviewFacts: [
      { label: "Consensus", value: "Proof of Stake" },
      { label: "Launch", value: "July 2015" },
      { label: "Max supply", value: "No hard cap" },
      { label: "Founders", value: "Vitalik Buterin et al." },
      { label: "UCID", value: "1027" },
      { label: "Category", value: "Smart Contracts · Layer 1" },
    ],
    tags: ["Smart Contracts", "PoS", "Layer 1", "DeFi", "Ethereum Ecosystem"],
    website: "https://ethereum.org",
    explorer: "https://etherscan.io",
    whitepaper: "https://ethereum.org/en/whitepaper/",
    maxSupply: null,
    news: [
      {
        title: "Bitcoin, Ethereum Soar as CLARITY Act Edges Closer",
        summary:
          "ETH joined BTC in a regulatory-catalyst week; CMC covers flows, sentiment, and macro risk.",
        url: "https://coinmarketcap.com/academy/article/btc-eth-soar-clarity-act-fed-hike-end-rally",
        source: "CoinMarketCap Academy",
      },
      {
        title: "CMC Market Pulse — Situational Awareness Bailout",
        summary:
          "Weekly CMC pulse with ETH relative strength amid equity volatility and crypto liquidations.",
        url: "https://coinmarketcap.com/academy/article/cmc-market-pulse-situational-awareness-bailout-market-is-saved",
        source: "CoinMarketCap Academy",
      },
      {
        title: "Ethereum on CoinMarketCap — News feed",
        summary:
          "Latest Top & Latest headlines for ETH directly on the CoinMarketCap currency page.",
        url: "https://coinmarketcap.com/currencies/ethereum/#news",
        source: "CoinMarketCap",
      },
    ],
    analysis: {
      summary:
        "CMC lists Ethereum as the #2 asset with uncapped supply. Analysis usually centers on staking yield narrative, L2 activity, gas demand, and ETH’s correlation with BTC while watching Vol/Mkt Cap and FDV vs market cap.",
      points: [
        {
          title: "Network utility",
          detail:
            "ETH demand is tied to smart-contract usage, DeFi TVL, and Layer-2 settlement — key CMC narrative tags.",
        },
        {
          title: "Supply dynamics",
          detail:
            "No max supply on CMC; issuance and burn (post-EIP-1559 / PoS) shape circulating supply over time.",
        },
        {
          title: "Relative strength",
          detail:
            "Traders compare ETH/BTC and ETH’s 24h performance vs BTC on CMC leaderboards for Spot rotation and Perp bias.",
        },
      ],
      spotNote:
        "Spot ETH/USDT uses Funding. CMC About sections emphasize Ethereum as the primary smart-contract settlement layer.",
      perpNote:
        "ETHUSDT Perpetual tracks mark/funding. Gas and L2 news on CMC often precede volatility in Perp OI.",
    },
  },
  SOL: {
    market: "SOL",
    slug: "solana",
    url: "https://coinmarketcap.com/currencies/solana/",
    newsUrl: "https://coinmarketcap.com/currencies/solana/#news",
    analysisUrl: "https://coinmarketcap.com/currencies/solana/",
    ucid: 5426,
    rank: 7,
    name: "Solana",
    symbol: "SOL",
    about:
      "Solana is a high-throughput Layer 1 that combines Proof of History with Proof of Stake for fast finality and low fees. Officially launched in March 2020 by the Solana Foundation, SOL pays network fees, funds smart-contract execution, and is the staking asset for validators across DeFi, NFTs, payments, and consumer apps. CoinMarketCap ranks SOL among the top Layer-1 assets.",
    overviewFacts: [
      { label: "Consensus", value: "PoH + PoS" },
      { label: "Launch", value: "March 2020" },
      { label: "Max supply", value: "∞ (no hard cap)" },
      { label: "Founders", value: "Anatoly Yakovenko et al." },
      { label: "UCID", value: "5426" },
      { label: "Category", value: "Solana Ecosystem · Layer 1" },
    ],
    tags: ["Solana Ecosystem", "Layer 1", "Smart Contracts", "DeFi"],
    website: "https://solana.com",
    explorer: "https://solscan.io",
    whitepaper: "https://solana.com/solana-whitepaper.pdf",
    maxSupply: null,
    news: [
      {
        title: "CMC Market Pulse — Crypto Market Seeks Clarity",
        summary:
          "Weekly pulse covering majors including Solana ecosystem headlines and broader market structure.",
        url: "https://coinmarketcap.com/academy/article/cmc-market-pulse-crypto-market-seeks-clarity",
        source: "CoinMarketCap Academy",
      },
      {
        title: "Solana on CoinMarketCap — News feed",
        summary:
          "Top & Latest SOL headlines on the official CoinMarketCap Solana currency page.",
        url: "https://coinmarketcap.com/currencies/solana/#news",
        source: "CoinMarketCap",
      },
      {
        title: "What Is Solana (SOL)? — CMC listing",
        summary:
          "CMC About: PoH/PoS hybrid, DeFi focus, and Solana Foundation launch context.",
        url: "https://coinmarketcap.com/currencies/solana/",
        source: "CoinMarketCap",
      },
    ],
    analysis: {
      summary:
        "CMC frames Solana as a speed/low-fee L1 (#7 typical rank). Analysis focuses on throughput narrative, ecosystem tokens, 24h volume vs market cap, and ATH drawdown after prior cycle peaks.",
      points: [
        {
          title: "Throughput thesis",
          detail:
            "PoH + PoS underpins CMC’s “unique” section — fast confirmation and low fees vs older L1s.",
        },
        {
          title: "Ecosystem activity",
          detail:
            "DeFi, NFTs, memecoins, and payments on Solana often show up in CMC Related Articles and volume spikes.",
        },
        {
          title: "Risk cues",
          detail:
            "Historical outage narrative and high beta to BTC — watch CMC 24h range and Vol/Mkt Cap for Spot/Perp sizing.",
        },
      ],
      spotNote:
        "Spot SOL/USDT settles from Funding. CMC circulating supply and ∞ max supply are key overview stats.",
      perpNote:
        "SOLUSDT Perpetual is high-beta; CMC news on ecosystem launches can drive funding and liquidations.",
    },
  },
  PI: {
    market: "PI",
    slug: "pi",
    url: "https://coinmarketcap.com/currencies/pi/",
    newsUrl: "https://coinmarketcap.com/currencies/pi/#news",
    analysisUrl: "https://coinmarketcap.com/currencies/pi/",
    ucid: 35697,
    rank: 55,
    name: "Pi",
    symbol: "PI",
    about:
      "Pi Network is a social cryptocurrency, developer platform, and ecosystem designed for widespread accessibility and real-world utility. Users mine and transact PI with a mobile-friendly interface while supporting apps on its blockchain. CoinMarketCap lists a max supply of 100 billion PI with allocations for community mining (65%), foundation (10%), liquidity (5%), and the Core Team (20%). Founded by Dr. Nicolas Kokkalis and Dr. Chengdiao Fan.",
    overviewFacts: [
      { label: "Consensus", value: "Mobile-first · Mainnet" },
      { label: "Founders", value: "Kokkalis & Fan (Stanford)" },
      { label: "Max supply", value: "100,000,000,000 PI" },
      { label: "Community mining", value: "65% of max supply" },
      { label: "UCID", value: "35697" },
      { label: "Category", value: "Layer 1 · Mobile Mining" },
    ],
    tags: ["Layer 1", "Mobile Mining"],
    website: "https://minepi.com",
    explorer: "https://blockexplorer.minepi.com",
    maxSupply: 100_000_000_000,
    news: [
      {
        title: "Pi (PI) Surges on Network Upgrade News",
        summary:
          "CMC Top Stories: Protocol 26/27 roadmap and launchpad liquidity model as near-term catalysts.",
        url: "https://coinmarketcap.com/top-stories/6a6d7e6724178700e5f2e5e9/",
        source: "CoinMarketCap Top Stories",
      },
      {
        title: "Pi on CoinMarketCap — News feed",
        summary:
          "Top & Latest PI headlines on the official CoinMarketCap Pi currency page.",
        url: "https://coinmarketcap.com/currencies/pi/#news",
        source: "CoinMarketCap",
      },
      {
        title: "What Is Pi Network? — CMC About",
        summary:
          "CMC listing covers founders, 100B max supply model, KYC, and ecosystem adoption (e.g. PiFest).",
        url: "https://coinmarketcap.com/currencies/pi/",
        source: "CoinMarketCap",
      },
    ],
    analysis: {
      summary:
        "CMC ranks Pi around mid-cap (#55 typical) with a large max supply and smaller circulating share. Analysis emphasizes protocol roadmap news, community sentiment, and distance from the Feb 2025 ATH vs recent ATL.",
      points: [
        {
          title: "Supply model",
          detail:
            "100B max: 65% community mining, 10% foundation, 5% liquidity, 20% Core Team — proportions track migrated mining rewards.",
        },
        {
          title: "Catalyst watch",
          detail:
            "CMC coverage highlights Protocol upgrades and Launchpad liquidity as drivers of short-term Spot/Perp moves.",
        },
        {
          title: "Liquidity & volatility",
          detail:
            "Lower absolute 24h volume vs majors on CMC means thinner books — size Spot and Perp carefully.",
        },
      ],
      spotNote:
        "Spot PI/USDT uses Funding. Track CMC circulating vs max supply and news on Mainnet migrations.",
      perpNote:
        "PIUSDT Perpetual can gap on upgrade headlines; use mark/funding and CMC news before adding leverage.",
    },
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
