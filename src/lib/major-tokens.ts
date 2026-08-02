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
  | "eurc"
  | "hype"
  | "zec"
  | "tslax"
  | "nflxx"
  | "googlx"
  | "bnb"
  | "uni"
  | "okb"
  | "gt"
  | "bgb"
  | "cake"
  | "jup"
  | "ron"
  | "xrp"
  | "trx"
  | "doge"
  | "ada"
  | "link"
  | "xlm"
  | "bch"
  | "gram"
  | "avax"
  | "sui"
  | "xaut"
  | "ondo"
  | "near"
  | "usdy"
  | "paxg"
  | "wlfi"
  | "aster"
  | "rlusd"
  | "aave"
  | "dot"
  | "pump";

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
      "Bitcoin is the world's first decentralized cryptocurrency, created in 2009 by the pseudonymous Satoshi Nakamoto. It enables peer-to-peer electronic cash without intermediaries, secured by Proof of Work on a public blockchain with a hard cap of 21 million coins. Often called digital gold, BTC is the reserve asset of crypto. Market reference: CoinMarketCap.",
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
      "Ether (ETH) is Ethereum's native token — the fuel for smart contracts, DeFi, NFTs, and Layer-2 networks. Proposed by Vitalik Buterin and launched in 2015, Ethereum moved to Proof of Stake in the 2022 Merge. ETH pays gas, secures the network via staking, and powers the largest application ecosystem in crypto. Market reference: CoinMarketCap.",
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
      "SOL is the native token of the Solana blockchain — a high-throughput Layer 1 launched in 2020. Proof of History plus Proof of Stake delivers fast finality and sub-cent fees. SOL pays every network fee, funds smart-contract execution, and is the staking asset for validators. Solana hosts a major ecosystem across DeFi, NFTs, payments, and consumer apps. Market reference: CoinMarketCap.",
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
      "Pi Network is a social cryptocurrency, developer platform, and ecosystem designed for widespread accessibility and real-world utility. It enables users to mine and transact Pi with a mobile-friendly interface while supporting applications on its blockchain. Max supply is 100 billion PI. Market reference: CoinMarketCap.",
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
    logoUrl: "https://424565.fs1.hubspotusercontent-na1.net/hubfs/424565/PYUSDLOGO.png",
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
    logoUrl: "https://424565.fs1.hubspotusercontent-na1.net/hubfs/424565/GDN-USDG-Token-512x512.png",
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
    logoUrl: "https://raw.githubusercontent.com/worldliberty/usd1-metadata/refs/heads/main/logo.png",
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
    logoUrl: "https://token-metadata.bridge.xyz/images/cash.png",
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
    logoUrl:
      "https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/ethereum/assets/0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c/logo.png",
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
  hype: {
    id: "hype",
    name: "HYPE",
    symbol: "HYPE",
    network: "Solana",
    category: "Bridged asset",
    logoUrl: "https://assets.coingecko.com/coins/images/50882/large/hyperliquid.jpg",
    website: "https://hyperfoundation.org",
    coingeckoId: "hyperliquid",
    createdLabel: "Oct 2025",
    createdAt: "2025-10-01T00:00:00.000Z",
    native: false,
    mintAddress: "98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g",
    phantomUrl:
      "https://phantom.com/tokens/solana/98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g",
    about:
      "HYPE on Solana is a bridged representation of Hyperliquid’s native gas/governance token. OpenPay Pro credits HYPE on your custodial ledger at market price (buy/swap/send with OUSD). Always verify mint 98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g.",
  },
  zec: {
    id: "zec",
    name: "Zcash",
    symbol: "ZEC",
    network: "Solana",
    category: "Privacy",
    logoUrl: "https://assets.coingecko.com/coins/images/486/large/circle-zcash-color.png",
    website: "https://z.cash",
    coingeckoId: "zcash",
    createdLabel: "Oct 2025",
    createdAt: "2025-10-01T00:00:00.000Z",
    native: false,
    mintAddress: "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS",
    phantomUrl:
      "https://phantom.com/tokens/solana/A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS",
    about:
      "ZEC on Solana is a Phantom-listed Solana representation of Zcash. OpenPay Pro credits ZEC on your custodial ledger at market price. Confirm mint A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS — same-ticker fakes exist.",
  },
  tslax: {
    id: "tslax",
    name: "Tesla xStock",
    symbol: "TSLAX",
    network: "Solana",
    category: "xStock",
    logoUrl:
      "https://coin-images.coingecko.com/coins/images/55638/large/Ticker_TSLA__Company_Name_Tesla_Inc.__size_200x200_2x.png?1746863299",
    website: "https://assets.backed.fi/products/tesla-xstock",
    coingeckoId: "tesla-xstock",
    createdLabel: "Jun 2025",
    createdAt: "2025-06-01T00:00:00.000Z",
    native: false,
    mintAddress: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    phantomUrl:
      "https://phantom.com/tokens/solana/XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    about:
      "Tesla xStock (TSLAX) is a Solana tokenized equity product. OpenPay Pro credits TSLAX on your custodial ledger at market price. Verify mint XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB and issuer terms before buying.",
  },
  nflxx: {
    id: "nflxx",
    name: "Netflix xStock",
    symbol: "NFLXX",
    network: "Solana",
    category: "xStock",
    logoUrl:
      "https://coin-images.coingecko.com/coins/images/55632/large/Ticker_NFLX__Company_Name_Netflix_Inc.__size_200x200_2x.png?1746862692",
    website: "https://assets.backed.fi/products/netflix-xstock",
    coingeckoId: "netflix-xstock",
    createdLabel: "Jun 2025",
    createdAt: "2025-06-01T00:00:00.000Z",
    native: false,
    mintAddress: "XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL",
    phantomUrl:
      "https://phantom.com/tokens/solana/XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL",
    about:
      "Netflix xStock (NFLXX) is a Solana tokenized equity product. OpenPay Pro credits NFLXX on your custodial ledger at market price. Verify mint XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL before trading.",
  },
  googlx: {
    id: "googlx",
    name: "Alphabet xStock",
    symbol: "GOOGLX",
    network: "Solana",
    category: "xStock",
    logoUrl:
      "https://coin-images.coingecko.com/coins/images/55610/large/Ticker_GOOG__Company_Name_Alphabet_Inc.__size_200x200_2x.png",
    website: "https://assets.backed.fi/products/alphabet-xstock",
    coingeckoId: "alphabet-xstock",
    createdLabel: "Jun 2025",
    createdAt: "2025-06-01T00:00:00.000Z",
    native: false,
    mintAddress: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
    phantomUrl:
      "https://phantom.com/tokens/solana/XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
    about:
      "Alphabet xStock (GOOGLX) is a Solana tokenized equity product. OpenPay Pro credits GOOGLX on your custodial ledger at market price. Verify mint XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN before trading.",
  },
  bnb: {
    id: "bnb",
    name: "BNB",
    symbol: "BNB",
    network: "BNB Smart Chain",
    category: "Layer 1",
    logoUrl: "https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
    website: "https://www.bnbchain.org",
    twitter: "https://x.com/BNBCHAIN",
    coingeckoId: "binancecoin",
    createdLabel: "Jul 2017",
    createdAt: "2017-07-25T00:00:00.000Z",
    native: true,
    about:
      "BNB is the native asset of BNB Smart Chain (BSC) — used for gas, staking, and ecosystem apps across Binance’s multi-chain stack. OpenPay Pro credits BNB on your custodial ledger at CoinGecko market price.",
  },
  uni: {
    id: "uni",
    name: "Uniswap",
    symbol: "UNI",
    network: "Ethereum",
    category: "DeFi",
    logoUrl: "https://coin-images.coingecko.com/coins/images/12504/large/uniswap-logo.png",
    website: "https://uniswap.org",
    twitter: "https://x.com/Uniswap",
    coingeckoId: "uniswap",
    createdLabel: "Sep 2020",
    createdAt: "2020-09-17T00:00:00.000Z",
    native: false,
    contractAddress: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    about:
      "UNI is the governance token of Uniswap, the leading Ethereum DEX protocol. OpenPay Pro credits UNI on your custodial ledger at market price. Verify Ethereum contract 0x1f9840a85d5af5bf1d1762f925bdaddc4201f984.",
  },
  okb: {
    id: "okb",
    name: "OKB",
    symbol: "OKB",
    network: "Ethereum",
    category: "Exchange",
    logoUrl:
      "https://coin-images.coingecko.com/coins/images/4463/large/WeChat_Image_20220118095654.png",
    website: "https://www.okx.com",
    twitter: "https://x.com/okx",
    coingeckoId: "okb",
    createdLabel: "May 2019",
    createdAt: "2019-05-01T00:00:00.000Z",
    native: false,
    contractAddress: "0x75231f58b43240c9718dd58b4967c5114342a86c",
    about:
      "OKB is the utility token of the OKX exchange ecosystem. OpenPay Pro credits OKB on your custodial ledger at market price. Verify Ethereum contract 0x75231f58b43240c9718dd58b4967c5114342a86c.",
  },
  gt: {
    id: "gt",
    name: "Gate",
    symbol: "GT",
    network: "Ethereum",
    category: "Exchange",
    logoUrl: "https://coin-images.coingecko.com/coins/images/8183/large/200X200.png",
    website: "https://www.gate.io",
    twitter: "https://x.com/Gate",
    coingeckoId: "gatechain-token",
    createdLabel: "Apr 2019",
    createdAt: "2019-04-01T00:00:00.000Z",
    native: false,
    contractAddress: "0xe28b3b32b6c345a34ff64674606124dd5aceca30",
    about:
      "GT (GateToken) is the utility token of the Gate exchange and GateChain ecosystem. OpenPay Pro credits GT on your custodial ledger at market price. Verify Ethereum contract 0xe28b3b32b6c345a34ff64674606124dd5aceca30.",
  },
  bgb: {
    id: "bgb",
    name: "Bitget Token",
    symbol: "BGB",
    network: "Ethereum",
    category: "Exchange",
    logoUrl: "https://coin-images.coingecko.com/coins/images/11610/large/Bitget_logo.png",
    website: "https://www.bitget.com",
    twitter: "https://x.com/bitgetglobal",
    coingeckoId: "bitget-token",
    createdLabel: "Jul 2021",
    createdAt: "2021-07-01T00:00:00.000Z",
    native: false,
    contractAddress: "0x54d2252757e1672eead234d27b1270728ff90581",
    about:
      "BGB is the utility token of the Bitget exchange. OpenPay Pro credits BGB on your custodial ledger at market price. Verify Ethereum contract 0x54d2252757e1672eead234d27b1270728ff90581.",
  },
  cake: {
    id: "cake",
    name: "PancakeSwap",
    symbol: "CAKE",
    network: "BNB Smart Chain",
    category: "DeFi",
    logoUrl:
      "https://coin-images.coingecko.com/coins/images/12632/large/pancakeswap-cake-logo_%281%29.png",
    website: "https://pancakeswap.finance",
    twitter: "https://x.com/PancakeSwap",
    coingeckoId: "pancakeswap-token",
    createdLabel: "Sep 2020",
    createdAt: "2020-09-29T00:00:00.000Z",
    native: false,
    contractAddress: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    about:
      "CAKE is the governance and incentive token of PancakeSwap, the leading DEX on BNB Smart Chain. OpenPay Pro credits CAKE on your custodial ledger at market price. Verify BSC contract 0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82.",
  },
  jup: {
    id: "jup",
    name: "Jupiter",
    symbol: "JUP",
    network: "Solana",
    category: "DeFi",
    logoUrl: "https://coin-images.coingecko.com/coins/images/34188/large/jup.png",
    website: "https://jup.ag",
    twitter: "https://x.com/JupiterExchange",
    coingeckoId: "jupiter-exchange-solana",
    createdLabel: "Jan 2024",
    createdAt: "2024-01-31T00:00:00.000Z",
    native: false,
    mintAddress: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    phantomUrl:
      "https://phantom.com/tokens/solana/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    about:
      "JUP is the governance token of Jupiter, Solana’s leading DEX aggregator. OpenPay Pro credits JUP on your custodial ledger at market price. Verify mint JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN.",
  },
  ron: {
    id: "ron",
    name: "Ronin",
    symbol: "RON",
    network: "Ronin",
    category: "Layer 1",
    logoUrl:
      "https://coin-images.coingecko.com/coins/images/20009/large/photo_2024-04-06_22-52-24.jpg",
    website: "https://roninchain.com",
    twitter: "https://x.com/Ronin_Network",
    coingeckoId: "ronin",
    createdLabel: "Feb 2022",
    createdAt: "2022-02-01T00:00:00.000Z",
    native: true,
    about:
      "RON is the native gas and staking token of the Ronin blockchain — the gaming-focused chain behind Axie Infinity and other titles. OpenPay Pro credits RON on your custodial ledger at CoinGecko market price.",
  },
  xrp: {
    id: "xrp",
    name: "XRP",
    symbol: "XRP",
    network: "XRP Ledger",
    category: "Layer 1",
    logoUrl: "https://coin-images.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png",
    website: "https://xrpl.org",
    twitter: "https://x.com/Ripple",
    coingeckoId: "ripple",
    createdLabel: "2013",
    createdAt: "2013-01-01T00:00:00.000Z",
    native: true,
    about:
      "XRP is the native asset of the XRP Ledger — designed for fast, low-cost cross-border settlement. OpenPay Pro credits XRP on your custodial ledger at CoinGecko market price.",
  },
  trx: {
    id: "trx",
    name: "TRON",
    symbol: "TRX",
    network: "TRON",
    category: "Layer 1",
    logoUrl: "https://coin-images.coingecko.com/coins/images/1094/large/photo_2026-04-13_09-59-16.png",
    website: "https://tron.network",
    twitter: "https://x.com/trondao",
    coingeckoId: "tron",
    createdLabel: "Sep 2017",
    createdAt: "2017-09-13T00:00:00.000Z",
    native: true,
    about:
      "TRX is the native gas and staking token of the TRON blockchain. OpenPay Pro credits TRX on your custodial ledger at CoinGecko market price.",
  },
  doge: {
    id: "doge",
    name: "Dogecoin",
    symbol: "DOGE",
    network: "Dogecoin",
    category: "Meme",
    logoUrl: "https://coin-images.coingecko.com/coins/images/5/large/dogecoin.png",
    website: "https://dogecoin.com",
    twitter: "https://x.com/dogecoin",
    coingeckoId: "dogecoin",
    createdLabel: "Dec 2013",
    createdAt: "2013-12-06T00:00:00.000Z",
    native: true,
    about:
      "Dogecoin (DOGE) is a peer-to-peer cryptocurrency inspired by the Shiba Inu meme. OpenPay Pro credits DOGE on your custodial ledger at CoinGecko market price.",
  },
  ada: {
    id: "ada",
    name: "Cardano",
    symbol: "ADA",
    network: "Cardano",
    category: "Layer 1",
    logoUrl: "https://coin-images.coingecko.com/coins/images/975/large/cardano.png",
    website: "https://cardano.org",
    twitter: "https://x.com/Cardano",
    coingeckoId: "cardano",
    createdLabel: "Sep 2017",
    createdAt: "2017-09-29T00:00:00.000Z",
    native: true,
    about:
      "ADA is the native token of Cardano — a proof-of-stake Layer 1 focused on research-driven design. OpenPay Pro credits ADA on your custodial ledger at CoinGecko market price.",
  },
  link: {
    id: "link",
    name: "Chainlink",
    symbol: "LINK",
    network: "Ethereum",
    category: "Oracle",
    logoUrl: "https://coin-images.coingecko.com/coins/images/877/large/Chainlink_Logo_500.png",
    website: "https://chain.link",
    twitter: "https://x.com/chainlink",
    coingeckoId: "chainlink",
    createdLabel: "Sep 2017",
    createdAt: "2017-09-19T00:00:00.000Z",
    native: false,
    contractAddress: "0x514910771af9ca656af840dff83e8264ecf986ca",
    about:
      "LINK is the utility token of Chainlink, the leading decentralized oracle network. OpenPay Pro credits LINK on your custodial ledger at market price. Verify Ethereum contract 0x514910771af9ca656af840dff83e8264ecf986ca.",
  },
  xlm: {
    id: "xlm",
    name: "Stellar",
    symbol: "XLM",
    network: "Stellar",
    category: "Layer 1",
    logoUrl: "https://coin-images.coingecko.com/coins/images/100/large/fmpFRHHQ_400x400.jpg",
    website: "https://stellar.org",
    twitter: "https://x.com/StellarOrg",
    coingeckoId: "stellar",
    createdLabel: "2014",
    createdAt: "2014-07-31T00:00:00.000Z",
    native: true,
    about:
      "XLM is the native asset of the Stellar network — built for fast, low-cost cross-border payments. OpenPay Pro credits XLM on your custodial ledger at CoinGecko market price.",
  },
  bch: {
    id: "bch",
    name: "Bitcoin Cash",
    symbol: "BCH",
    network: "Bitcoin Cash",
    category: "Layer 1",
    logoUrl: "https://coin-images.coingecko.com/coins/images/780/large/bitcoin-cash-circle.png",
    website: "https://bitcoincash.org",
    twitter: "https://x.com/BITCOINCASH",
    coingeckoId: "bitcoin-cash",
    createdLabel: "Aug 2017",
    createdAt: "2017-08-01T00:00:00.000Z",
    native: true,
    about:
      "Bitcoin Cash (BCH) is a peer-to-peer electronic cash fork of Bitcoin focused on larger blocks and everyday payments. OpenPay Pro credits BCH on your custodial ledger at CoinGecko market price.",
  },
  gram: {
    id: "gram",
    name: "Gram",
    symbol: "GRAM",
    network: "TON",
    category: "Layer 1",
    logoUrl: "https://coin-images.coingecko.com/coins/images/17980/large/Gram_Circular_Badge.png",
    website: "https://ton.org",
    twitter: "https://x.com/ton_blockchain",
    coingeckoId: "the-open-network",
    createdLabel: "2021",
    createdAt: "2021-08-01T00:00:00.000Z",
    native: true,
    about:
      "GRAM (formerly Toncoin) is the native gas and staking token of The Open Network (TON). OpenPay Pro credits GRAM on your custodial ledger at CoinGecko market price.",
  },
  avax: {
    id: "avax",
    name: "Avalanche",
    symbol: "AVAX",
    network: "Avalanche",
    category: "Layer 1",
    logoUrl:
      "https://coin-images.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png",
    website: "https://www.avax.network",
    twitter: "https://x.com/avax",
    coingeckoId: "avalanche-2",
    createdLabel: "Sep 2020",
    createdAt: "2020-09-21T00:00:00.000Z",
    native: true,
    about:
      "AVAX is the native token of Avalanche — used for fees, staking, and securing the Primary Network. OpenPay Pro credits AVAX on your custodial ledger at CoinGecko market price.",
  },
  sui: {
    id: "sui",
    name: "Sui",
    symbol: "SUI",
    network: "Sui",
    category: "Layer 1",
    logoUrl: "https://coin-images.coingecko.com/coins/images/26375/large/sui-ocean-square.png",
    website: "https://sui.io",
    twitter: "https://x.com/SuiNetwork",
    coingeckoId: "sui",
    createdLabel: "May 2023",
    createdAt: "2023-05-03T00:00:00.000Z",
    native: true,
    about:
      "SUI is the native gas and staking token of the Sui Layer 1 blockchain. OpenPay Pro credits SUI on your custodial ledger at CoinGecko market price.",
  },
  xaut: {
    id: "xaut",
    name: "Tether Gold",
    symbol: "XAUT",
    network: "Ethereum",
    category: "Commodity",
    logoUrl: "https://coin-images.coingecko.com/coins/images/10481/large/logo.png",
    website: "https://gold.tether.to/",
    twitter: "https://x.com/Tether_to",
    coingeckoId: "tether-gold",
    createdLabel: "Jan 2020",
    createdAt: "2020-01-01T00:00:00.000Z",
    native: false,
    contractAddress: "0x68749665ff8d2d112fa859aa293f07a622782f38",
    about:
      "XAUt (Tether Gold) is a gold-backed digital token issued by Tether. OpenPay Pro credits XAUt on your custodial ledger at market price. Verify Ethereum contract 0x68749665ff8d2d112fa859aa293f07a622782f38.",
  },
  ondo: {
    id: "ondo",
    name: "Ondo",
    symbol: "ONDO",
    network: "Ethereum",
    category: "RWA",
    logoUrl: "https://coin-images.coingecko.com/coins/images/26580/large/ONDO.png",
    website: "https://ondo.foundation/",
    twitter: "https://x.com/ondo_finance",
    coingeckoId: "ondo-finance",
    createdLabel: "Jan 2024",
    createdAt: "2024-01-18T00:00:00.000Z",
    native: false,
    contractAddress: "0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3",
    about:
      "ONDO is the governance token of Ondo Finance, focused on tokenized real-world assets. OpenPay Pro credits ONDO on your custodial ledger at market price. Verify Ethereum contract 0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3.",
  },
  near: {
    id: "near",
    name: "NEAR Protocol",
    symbol: "NEAR",
    network: "NEAR",
    category: "Layer 1",
    logoUrl: "https://coin-images.coingecko.com/coins/images/10365/large/near.jpg",
    website: "https://near.org",
    twitter: "https://x.com/NEARProtocol",
    coingeckoId: "near",
    createdLabel: "2020",
    createdAt: "2020-08-11T00:00:00.000Z",
    native: true,
    about:
      "NEAR is the native gas and staking token of the NEAR Protocol Layer 1. OpenPay Pro credits NEAR on your custodial ledger at CoinGecko market price.",
  },
  usdy: {
    id: "usdy",
    name: "Ondo US Dollar Yield",
    symbol: "USDY",
    network: "Ethereum",
    category: "Stablecoin",
    logoUrl: "https://coin-images.coingecko.com/coins/images/31700/large/usdy_%281%29.png",
    website: "https://ondo.finance/",
    twitter: "https://x.com/ondo_finance",
    coingeckoId: "ondo-us-dollar-yield",
    createdLabel: "Jan 2024",
    createdAt: "2024-01-14T00:00:00.000Z",
    native: false,
    contractAddress: "0x96f6ef951840721adbf46ac996b59e0235cb985c",
    about:
      "USDY is Ondo’s yield-bearing US dollar token. OpenPay Pro credits USDY on your custodial ledger at market price. Verify Ethereum contract 0x96f6ef951840721adbf46ac996b59e0235cb985c.",
  },
  paxg: {
    id: "paxg",
    name: "PAX Gold",
    symbol: "PAXG",
    network: "Ethereum",
    category: "Commodity",
    logoUrl: "https://coin-images.coingecko.com/coins/images/9519/large/asset-paxg.png",
    website: "https://www.paxos.com/paxgold/",
    twitter: "https://x.com/Paxos",
    coingeckoId: "pax-gold",
    createdLabel: "Sep 2019",
    createdAt: "2019-09-05T00:00:00.000Z",
    native: false,
    contractAddress: "0x45804880de22913dafe09f4980848ece6ecbaf78",
    about:
      "PAXG is a gold-backed ERC-20 token issued by Paxos. OpenPay Pro credits PAXG on your custodial ledger at market price. Verify Ethereum contract 0x45804880de22913dafe09f4980848ece6ecbaf78.",
  },
  wlfi: {
    id: "wlfi",
    name: "World Liberty Financial",
    symbol: "WLFI",
    network: "Ethereum",
    category: "Governance",
    logoUrl: "https://coin-images.coingecko.com/coins/images/50767/large/wlfi.png",
    website: "https://www.worldlibertyfinancial.com/",
    twitter: "https://x.com/worldlibertyfi",
    coingeckoId: "world-liberty-financial",
    createdLabel: "2025",
    createdAt: "2025-09-01T00:00:00.000Z",
    native: false,
    contractAddress: "0xda5e1988097297dcdc1f90d4dfe7909e847cbef6",
    about:
      "WLFI is the governance token of World Liberty Financial. OpenPay Pro credits WLFI on your custodial ledger at market price. Verify Ethereum contract 0xda5e1988097297dcdc1f90d4dfe7909e847cbef6.",
  },
  aster: {
    id: "aster",
    name: "Aster",
    symbol: "ASTER",
    network: "BNB Smart Chain",
    category: "DeFi",
    logoUrl: "https://coin-images.coingecko.com/coins/images/69040/large/_ASTER.png",
    website: "https://www.asterdex.com/en",
    twitter: "https://x.com/Aster_DEX",
    coingeckoId: "aster-2",
    createdLabel: "Sep 2025",
    createdAt: "2025-09-17T00:00:00.000Z",
    native: false,
    contractAddress: "0x000ae314e2a2172a039b26378814c252734f556a",
    about:
      "ASTER is the token of Aster DEX on BNB Smart Chain. OpenPay Pro credits ASTER on your custodial ledger at market price. Verify BSC contract 0x000ae314e2a2172a039b26378814c252734f556a.",
  },
  rlusd: {
    id: "rlusd",
    name: "Ripple USD",
    symbol: "RLUSD",
    network: "XRP Ledger",
    category: "Stablecoin",
    logoUrl: "https://coin-images.coingecko.com/coins/images/39651/large/RLUSD_200x200_%281%29.png",
    website: "https://ripple.com/solutions/stablecoin/",
    twitter: "https://x.com/Ripple",
    coingeckoId: "ripple-usd",
    createdLabel: "Dec 2024",
    createdAt: "2024-12-17T00:00:00.000Z",
    native: false,
    contractAddress: "0x8292bb45bf1ee4d140127049757c2e0ff06317ed",
    about:
      "RLUSD is Ripple’s USD-pegged stablecoin, issued on the XRP Ledger and Ethereum. OpenPay Pro credits RLUSD on your custodial ledger at market price.",
  },
  aave: {
    id: "aave",
    name: "Aave",
    symbol: "AAVE",
    network: "Ethereum",
    category: "DeFi",
    logoUrl: "https://coin-images.coingecko.com/coins/images/12645/large/aave-token-round.png",
    website: "https://aave.com",
    twitter: "https://x.com/aave",
    coingeckoId: "aave",
    createdLabel: "Oct 2020",
    createdAt: "2020-10-02T00:00:00.000Z",
    native: false,
    contractAddress: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
    about:
      "AAVE is the governance token of the Aave lending protocol. OpenPay Pro credits AAVE on your custodial ledger at market price. Verify Ethereum contract 0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9.",
  },
  dot: {
    id: "dot",
    name: "Polkadot",
    symbol: "DOT",
    network: "Polkadot",
    category: "Layer 1",
    logoUrl: "https://coin-images.coingecko.com/coins/images/12171/large/polkadot.jpg",
    website: "https://polkadot.network",
    twitter: "https://x.com/Polkadot",
    coingeckoId: "polkadot",
    createdLabel: "May 2020",
    createdAt: "2020-05-26T00:00:00.000Z",
    native: true,
    about:
      "DOT is the native token of Polkadot — used for staking, governance, and bonding parachains. OpenPay Pro credits DOT on your custodial ledger at CoinGecko market price.",
  },
  pump: {
    id: "pump",
    name: "Pump.fun",
    symbol: "PUMP",
    network: "Solana",
    category: "Meme",
    logoUrl: "https://coin-images.coingecko.com/coins/images/67164/large/pump.jpg",
    website: "https://pump.fun",
    twitter: "https://x.com/pumpdotfun",
    coingeckoId: "pump-fun",
    createdLabel: "Jul 2025",
    createdAt: "2025-07-12T00:00:00.000Z",
    native: false,
    mintAddress: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
    phantomUrl:
      "https://phantom.com/tokens/solana/pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
    about:
      "PUMP is the platform token of Pump.fun on Solana. OpenPay Pro credits PUMP on your custodial ledger at market price. Verify mint pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn.",
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
  "HYPE",
  "ZEC",
  "TSLAX",
  "NFLXX",
  "GOOGLX",
  "BNB",
  "UNI",
  "OKB",
  "GT",
  "BGB",
  "CAKE",
  "JUP",
  "RON",
  "XRP",
  "TRX",
  "DOGE",
  "ADA",
  "LINK",
  "XLM",
  "BCH",
  "GRAM",
  "AVAX",
  "SUI",
  "XAUT",
  "ONDO",
  "NEAR",
  "USDY",
  "PAXG",
  "WLFI",
  "ASTER",
  "RLUSD",
  "AAVE",
  "DOT",
  "PUMP",
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
  "Zcash",
  "ZCASH",
  "TESLA XSTOCK",
  "NETFLIX XSTOCK",
  "ALPHABET XSTOCK",
  "UNISWAP",
  "GATETOKEN",
  "GATE TOKEN",
  "GATE",
  "BITGET TOKEN",
  "BITGET",
  "PANCAKESWAP",
  "JUPITER",
  "RONIN",
  "BINANCE COIN",
  "TRON",
  "DOGECOIN",
  "CARDANO",
  "CHAINLINK",
  "STELLAR",
  "BITCOIN CASH",
  "RIPPLE",
  "GRAM",
  "TONCOIN",
  "TON",
  "AVALANCHE",
  "TETHER GOLD",
  "ONDO FINANCE",
  "NEAR PROTOCOL",
  "ONDO US DOLLAR YIELD",
  "PAX GOLD",
  "WORLD LIBERTY FINANCIAL",
  "ASTER",
  "RIPPLE USD",
  "POLKADOT",
  "PUMP.FUN",
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
  hyperliquid: "hype",
  zcash: "zec",
  "tesla-xstock": "tslax",
  "netflix-xstock": "nflxx",
  "alphabet-xstock": "googlx",
  binancecoin: "bnb",
  uniswap: "uni",
  okb: "okb",
  "gatechain-token": "gt",
  "bitget-token": "bgb",
  "pancakeswap-token": "cake",
  "jupiter-exchange-solana": "jup",
  ronin: "ron",
  ripple: "xrp",
  tron: "trx",
  dogecoin: "doge",
  cardano: "ada",
  chainlink: "link",
  stellar: "xlm",
  "bitcoin-cash": "bch",
  "the-open-network": "gram",
  "avalanche-2": "avax",
  sui: "sui",
  "tether-gold": "xaut",
  "ondo-finance": "ondo",
  near: "near",
  "ondo-us-dollar-yield": "usdy",
  "pax-gold": "paxg",
  "world-liberty-financial": "wlfi",
  "aster-2": "aster",
  "ripple-usd": "rlusd",
  aave: "aave",
  polkadot: "dot",
  "pump-fun": "pump",
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
  hype: {
    price: 55,
    change24h: 0,
    marketCap: 3.8e7,
    volume24h: 5.1e6,
    totalSupply: 735_570,
    circulatingSupply: 735_570,
    ath: 74.45,
    atl: 20.97,
    athDate: "2026-01-01T00:00:00.000Z",
    atlDate: "2025-10-01T00:00:00.000Z",
  },
  zec: {
    price: 450,
    change24h: 0,
    marketCap: 4.0e7,
    volume24h: 5.7e6,
    totalSupply: 87_575,
    circulatingSupply: 87_575,
    ath: 697.18,
    atl: 196.79,
    athDate: "2026-01-01T00:00:00.000Z",
    atlDate: "2025-10-01T00:00:00.000Z",
  },
  tslax: {
    price: 308,
    change24h: 0,
    marketCap: 5.8e7,
    volume24h: 2.96e5,
    totalSupply: 229_640,
    circulatingSupply: 188_560,
    ath: 484.98,
    atl: 302.64,
    athDate: "2025-12-01T00:00:00.000Z",
    atlDate: "2025-06-01T00:00:00.000Z",
  },
  nflxx: {
    price: 70,
    change24h: 0,
    marketCap: 1.1e7,
    volume24h: 31,
    totalSupply: 155_060,
    circulatingSupply: 155_060,
    ath: 100,
    atl: 70,
    athDate: "2025-12-01T00:00:00.000Z",
    atlDate: "2025-06-01T00:00:00.000Z",
  },
  googlx: {
    price: 200,
    change24h: 0,
    marketCap: 2.9e7,
    volume24h: 7.5e4,
    totalSupply: 160_410,
    circulatingSupply: 80_960,
    ath: 400.26,
    atl: 176.77,
    athDate: "2025-12-01T00:00:00.000Z",
    atlDate: "2025-06-01T00:00:00.000Z",
  },
  bnb: {
    price: 584,
    change24h: 0,
    marketCap: 7.78e10,
    volume24h: 6.65e8,
    totalSupply: 133_165_134,
    circulatingSupply: 133_165_134,
    ath: 1369.99,
    atl: 0.0398177,
    athDate: "2025-10-13T00:41:24.000Z",
    atlDate: "2017-10-18T16:00:00.000Z",
  },
  uni: {
    price: 4.21,
    change24h: 0,
    marketCap: 2.63e9,
    volume24h: 1.94e8,
    totalSupply: 892_098_420,
    circulatingSupply: 624_854_424,
    ath: 44.92,
    atl: 1.03,
    athDate: "2021-05-02T21:25:04.000Z",
    atlDate: "2020-09-16T17:20:38.000Z",
  },
  okb: {
    price: 87.36,
    change24h: 0,
    marketCap: 1.83e9,
    volume24h: 1.1e7,
    totalSupply: 21_000_000,
    circulatingSupply: 21_000_000,
    ath: 228.74,
    atl: 0.580608,
    athDate: "2025-10-04T16:00:00.000Z",
    atlDate: "2019-01-13T16:00:00.000Z",
  },
  gt: {
    price: 6.46,
    change24h: 0,
    marketCap: 6.89e8,
    volume24h: 8.17e5,
    totalSupply: 118_829_529,
    circulatingSupply: 106_578_297,
    ath: 25.38,
    atl: 0.25754,
    athDate: "2025-01-25T16:00:00.000Z",
    atlDate: "2020-03-12T18:18:02.000Z",
  },
  bgb: {
    price: 1.63,
    change24h: 0,
    marketCap: 1.14e9,
    volume24h: 6.98e6,
    totalSupply: 910_920_875,
    circulatingSupply: 699_992_030,
    ath: 8.45,
    atl: 0.0142795,
    athDate: "2024-12-27T03:41:24.000Z",
    atlDate: "2020-06-24T20:17:05.000Z",
  },
  cake: {
    price: 1.42,
    change24h: 0,
    marketCap: 4.59e8,
    volume24h: 2.22e7,
    totalSupply: 334_683_355,
    circulatingSupply: 322_364_881,
    ath: 43.96,
    atl: 0.194441,
    athDate: "2021-04-30T02:08:22.000Z",
    atlDate: "2020-11-03T06:29:34.000Z",
  },
  jup: {
    price: 0.197,
    change24h: 0,
    marketCap: 6.53e8,
    volume24h: 1.6e7,
    totalSupply: 6_862_431_314,
    circulatingSupply: 3_320_312_968,
    ath: 2.0,
    atl: 0.135801,
    athDate: "2024-01-31T07:02:47.000Z",
    atlDate: "2026-02-12T10:35:44.000Z",
  },
  ron: {
    price: 0.0487,
    change24h: 0,
    marketCap: 3.76e7,
    volume24h: 5.47e5,
    totalSupply: 1_000_000_000,
    circulatingSupply: 772_401_679,
    ath: 4.45,
    atl: 0.04546125,
    athDate: "2024-03-25T21:12:38.000Z",
    atlDate: "2026-07-29T20:30:50.000Z",
  },
  xrp: {
    price: 1.083,
    change24h: 0,
    marketCap: 6.77e10,
    volume24h: 7.46e8,
    totalSupply: 99_985_635_707,
    circulatingSupply: 62_533_271_955,
    ath: 3.65,
    atl: 0.00268621,
    athDate: "2025-07-17T19:40:53.000Z",
    atlDate: "2014-05-21T16:00:00.000Z",
  },
  trx: {
    price: 0.328,
    change24h: 0,
    marketCap: 3.11e10,
    volume24h: 3.23e8,
    totalSupply: 94_889_738_325,
    circulatingSupply: 94_887_226_060,
    ath: 0.431288,
    atl: 0.00180434,
    athDate: "2024-12-03T16:10:40.000Z",
    atlDate: "2017-11-11T16:00:00.000Z",
  },
  doge: {
    price: 0.0703,
    change24h: 0,
    marketCap: 1.09e10,
    volume24h: 4.27e8,
    totalSupply: 171_033_883_127,
    circulatingSupply: 155_322_116_384,
    ath: 0.731578,
    atl: 0.0000869,
    athDate: "2021-05-07T21:08:23.000Z",
    atlDate: "2015-05-05T16:00:00.000Z",
  },
  ada: {
    price: 0.187,
    change24h: 0,
    marketCap: 6.97e9,
    volume24h: 4.98e8,
    totalSupply: 45_000_000_000,
    circulatingSupply: 37_339_309_422,
    ath: 3.09,
    atl: 0.01925275,
    athDate: "2021-09-01T22:00:10.000Z",
    atlDate: "2020-03-12T18:22:55.000Z",
  },
  link: {
    price: 8.38,
    change24h: 0,
    marketCap: 6.27e9,
    volume24h: 1.8e8,
    totalSupply: 1_000_000_000,
    circulatingSupply: 748_099_970,
    ath: 52.7,
    atl: 0.148183,
    athDate: "2021-05-09T16:13:57.000Z",
    atlDate: "2017-11-28T16:00:00.000Z",
  },
  xlm: {
    price: 0.177,
    change24h: 0,
    marketCap: 6.05e9,
    volume24h: 9.5e7,
    totalSupply: 50_001_786_840,
    circulatingSupply: 34_269_415_319,
    ath: 0.875563,
    atl: 0.00047612,
    athDate: "2018-01-02T16:00:00.000Z",
    atlDate: "2015-03-04T16:00:00.000Z",
  },
  bch: {
    price: 212.24,
    change24h: 0,
    marketCap: 4.26e9,
    volume24h: 6.83e7,
    totalSupply: 20_069_553,
    circulatingSupply: 20_069_516,
    ath: 3785.82,
    atl: 76.93,
    athDate: "2017-12-19T16:00:00.000Z",
    atlDate: "2018-12-15T16:00:00.000Z",
  },
  gram: {
    price: 1.4,
    change24h: 0,
    marketCap: 3.84e9,
    volume24h: 1.37e7,
    totalSupply: 5_224_291_155,
    circulatingSupply: 2_737_907_057,
    ath: 8.25,
    atl: 0.519364,
    athDate: "2024-06-14T16:36:51.000Z",
    atlDate: "2021-09-20T16:33:11.000Z",
  },
  avax: {
    price: 6.62,
    change24h: 0,
    marketCap: 2.86e9,
    volume24h: 2.31e8,
    totalSupply: 463_441_061,
    circulatingSupply: 431_771_961,
    ath: 144.96,
    atl: 2.8,
    athDate: "2021-11-21T06:18:56.000Z",
    atlDate: "2020-12-31T05:15:21.000Z",
  },
  sui: {
    price: 0.691,
    change24h: 0,
    marketCap: 2.82e9,
    volume24h: 1.25e8,
    totalSupply: 10_000_000_000,
    circulatingSupply: 4_074_529_886,
    ath: 5.35,
    atl: 0.364846,
    athDate: "2025-01-04T14:56:18.000Z",
    atlDate: "2023-10-19T02:40:30.000Z",
  },
  xaut: {
    price: 4045,
    change24h: 0,
    marketCap: 2.48e9,
    volume24h: 9.65e7,
    totalSupply: 707_747,
    circulatingSupply: 612_824,
    ath: 5504.62,
    atl: 1447.84,
    athDate: "2026-01-28T16:00:00.000Z",
    atlDate: "2020-03-19T05:45:41.000Z",
  },
  ondo: {
    price: 0.393,
    change24h: 0,
    marketCap: 1.91e9,
    volume24h: 1.07e8,
    totalSupply: 10_000_000_000,
    circulatingSupply: 4_869_330_647,
    ath: 2.14,
    atl: 0.082171,
    athDate: "2024-12-15T16:36:00.000Z",
    atlDate: "2024-01-18T04:14:30.000Z",
  },
  near: {
    price: 1.72,
    change24h: 0,
    marketCap: 2.25e9,
    volume24h: 1.43e8,
    totalSupply: 1_302_468_080,
    circulatingSupply: 1_302_468_068,
    ath: 20.44,
    atl: 0.526762,
    athDate: "2022-01-16T14:09:45.000Z",
    atlDate: "2020-11-04T08:09:15.000Z",
  },
  usdy: {
    price: 1.14,
    change24h: 0,
    marketCap: 2.15e9,
    volume24h: 7.95e5,
    totalSupply: 1_886_428_222,
    circulatingSupply: 1_886_428_222,
    ath: 1.26,
    atl: 0.934184,
    athDate: "2024-03-26T21:24:08.000Z",
    atlDate: "2024-01-14T03:40:50.000Z",
  },
  paxg: {
    price: 4056,
    change24h: 0,
    marketCap: 1.79e9,
    volume24h: 3.05e7,
    totalSupply: 441_935,
    circulatingSupply: 441_935,
    ath: 5619.09,
    atl: 1399.64,
    athDate: "2026-01-28T22:30:56.000Z",
    atlDate: "2019-11-17T19:09:35.000Z",
  },
  wlfi: {
    price: 0.0554,
    change24h: 0,
    marketCap: 1.76e9,
    volume24h: 2.24e7,
    totalSupply: 100_000_000_000,
    circulatingSupply: 31_775_913_567,
    ath: 0.331336,
    atl: 0.051436,
    athDate: "2025-09-01T04:20:09.000Z",
    atlDate: "2026-07-23T01:01:40.000Z",
  },
  aster: {
    price: 0.604,
    change24h: 0,
    marketCap: 1.62e9,
    volume24h: 4.73e7,
    totalSupply: 7_813_984_361,
    circulatingSupply: 2_687_744_734,
    ath: 2.41,
    atl: 0.099713,
    athDate: "2025-09-24T03:18:14.000Z",
    atlDate: "2025-09-17T04:05:36.000Z",
  },
  rlusd: {
    price: 1,
    change24h: 0,
    marketCap: 1.47e9,
    volume24h: 3.41e7,
    totalSupply: 1_468_745_263,
    circulatingSupply: 1_468_745_263,
    ath: 1.073,
    atl: 0.962292,
    athDate: "2024-12-26T02:45:52.000Z",
    atlDate: "2024-12-17T20:40:40.000Z",
  },
  aave: {
    price: 92.46,
    change24h: 0,
    marketCap: 1.43e9,
    volume24h: 2.37e8,
    totalSupply: 16_000_000,
    circulatingSupply: 15_422_041,
    ath: 661.69,
    atl: 26.02,
    athDate: "2021-05-18T13:19:59.000Z",
    atlDate: "2020-11-05T01:20:11.000Z",
  },
  dot: {
    price: 0.792,
    change24h: 0,
    marketCap: 1.34e9,
    volume24h: 8.99e7,
    totalSupply: 1_696_110_785,
    circulatingSupply: 1_696_098_109,
    ath: 54.98,
    atl: 0.746764,
    athDate: "2021-11-04T06:10:09.000Z",
    atlDate: "2026-07-31T14:11:00.000Z",
  },
  pump: {
    price: 0.002184,
    change24h: 0,
    marketCap: 8.65e8,
    volume24h: 8.35e7,
    totalSupply: 844_259_966_287,
    circulatingSupply: 396_005_225_496,
    ath: 0.00881908,
    atl: 0.00115473,
    athDate: "2025-09-14T08:42:40.000Z",
    atlDate: "2026-06-25T17:04:20.000Z",
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

/** Perp / live chart timeframe pills (Phantom-style + intraday). */
export const PERP_CHART_PERIODS = [
  "LIVE",
  "1H",
  "4H",
  "1D",
  "1W",
  "1M",
  "1Y",
  "ALL",
] as const;
export type PerpChartPeriod = (typeof PERP_CHART_PERIODS)[number];

function chartPeriodWindowMs(period: PerpChartPeriod): number | null {
  switch (period) {
    case "LIVE":
      return 3 * 60 * 60 * 1000;
    case "1H":
      return 60 * 60 * 1000;
    case "4H":
      return 4 * 60 * 60 * 1000;
    case "1D":
      return 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

function chartPeriodCgDays(period: PerpChartPeriod): number | "max" {
  switch (period) {
    case "LIVE":
    case "1H":
    case "4H":
    case "1D":
      return 1;
    case "1W":
      return 7;
    case "1M":
      return 30;
    case "1Y":
      return 365;
    case "ALL":
      return "max";
  }
}

/**
 * Price series for perp charts. Uses CoinGecko market_chart for real
 * intraday/weekly history, then windows LIVE / 1H / 4H / 1D.
 */
export async function fetchMajorPriceSeries(
  majorId: MajorTokenId,
  period: PerpChartPeriod,
): Promise<number[]> {
  const def = MAJOR_TOKENS[majorId];
  if (!def?.coingeckoId || def.coingeckoId === "phantom-cash") return [];

  const days = chartPeriodCgDays(period);
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${def.coingeckoId}/market_chart?vs_currency=usd&days=${days}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) throw new Error(`CoinGecko chart ${res.status}`);
    const json = (await res.json()) as { prices?: [number, number][] };
    const rows = json.prices ?? [];
    if (!rows.length) return [];

    const windowMs = chartPeriodWindowMs(period);
    const now = Date.now();
    const filtered =
      windowMs == null
        ? rows
        : rows.filter(([ts]) => ts >= now - windowMs);

    const series = (filtered.length >= 4 ? filtered : rows).map(([, p]) => Number(p));
    return series.filter((p) => Number.isFinite(p) && p > 0);
  } catch {
    return [];
  }
}

/** Fallback slicer when live chart fetch is empty — CoinGecko 7d sparkline. */
export function sliceSparklineForPeriod(
  spark: number[],
  period: PerpChartPeriod,
): number[] {
  if (!spark.length) return spark;
  const n = spark.length;
  switch (period) {
    case "LIVE":
      return spark.slice(-Math.max(12, Math.floor(n / 14)));
    case "1H":
      return spark.slice(-Math.max(6, Math.floor(n / 48)));
    case "4H":
      return spark.slice(-Math.max(12, Math.floor(n / 12)));
    case "1D":
      return spark.slice(-Math.max(24, Math.floor(n / 7)));
    case "1W":
    case "1M":
    case "1Y":
    case "ALL":
    default:
      return spark;
  }
}

export { CG_ID_TO_MAJOR };
