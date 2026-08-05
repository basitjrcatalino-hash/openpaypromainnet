/**
 * OpenPay Pro partner & integration catalog for marketing surfaces.
 */

import { OUSD_LOGO_URL, OPENPAY_NETWORK_BADGE_URL, PI_NETWORK_LOGO_URL } from "@/lib/token-logos";
import { OPENPAY_AUTH_LOGO, OPENPAY_AI_MENU_ICON } from "@/lib/openpay-auth";
import { MAJOR_TOKENS, MAJOR_TOKEN_IDS, type MajorTokenId } from "@/lib/major-tokens";
import { WALLET_NETWORKS } from "@/lib/wallet-networks";
import { listedTradeMarkets } from "@/lib/trade-markets";

const si = (slug: string, color = "111111") =>
  `https://cdn.simpleicons.org/${slug}/${color}`;

/** Brand mark via Google favicon service (128px) when Simple Icons has no slug. */
const brand = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;

export type PartnerMark = {
  name: string;
  logo: string;
  href?: string;
  blurb?: string;
};

export type PartnerCategory = {
  id: string;
  title: string;
  blurb: string;
  partners: PartnerMark[];
};

/** Platform / product marks for the top marquee. */
export const ECOSYSTEM_MARKS: PartnerMark[] = [
  { name: "OpenUSD", logo: OUSD_LOGO_URL },
  { name: "OpenPay", logo: OPENPAY_AUTH_LOGO, href: "https://openpy.space" },
  { name: "Pi Network", logo: PI_NETWORK_LOGO_URL },
  { name: "OpenPay AI", logo: OPENPAY_AI_MENU_ICON },
  { name: "Open network", logo: OPENPAY_NETWORK_BADGE_URL },
  { name: "TradingView", logo: si("tradingview", "2962FF") },
  { name: "CoinGecko", logo: brand("coingecko.com") },
  { name: "CoinMarketCap", logo: si("coinmarketcap", "3861FB") },
  { name: "MoonPay", logo: brand("moonpay.com") },
  { name: "Solana", logo: si("solana", "9945FF") },
  { name: "Trust Wallet", logo: brand("trustwallet.com") },
  { name: "Phantom", logo: "/phantom-logo.svg" },
  { name: "Binance", logo: si("binance", "F0B90B") },
  { name: "OKX", logo: si("okx", "000000") },
  { name: "Circle", logo: si("circle", "063B74") },
];

export const PARTNER_CATEGORIES: PartnerCategory[] = [
  {
    id: "market-data",
    title: "Market data & charts",
    blurb: "Live prices, rankings, and professional charting for Spot and Perpetuals.",
    partners: [
      {
        name: "TradingView",
        logo: si("tradingview", "2962FF"),
        href: "https://www.tradingview.com",
        blurb: "Spot & perpetual chart widgets",
      },
      {
        name: "CoinGecko",
        logo: brand("coingecko.com"),
        href: "https://www.coingecko.com",
        blurb: "Major token USD prices",
      },
      {
        name: "CoinMarketCap",
        logo: si("coinmarketcap", "3861FB"),
        href: "https://coinmarketcap.com",
        blurb: "Market ranks & token marks",
      },
      {
        name: "Trust Wallet",
        logo: brand("trustwallet.com"),
        href: "https://trustwallet.com",
        blurb: "Asset index · quotes · safety",
      },
    ],
  },
  {
    id: "payments",
    title: "Payments & on-ramps",
    blurb: "Card, wallet, and crypto rails that credit OpenUSD on your Pro account.",
    partners: [
      {
        name: "MoonPay",
        logo: brand("moonpay.com"),
        href: "https://www.moonpay.com",
        blurb: "Card · Apple Pay · Google Pay",
      },
      {
        name: "Solana Pay",
        logo: si("solana", "9945FF"),
        href: "https://solanapay.com",
        blurb: "QR & PaymentButton → OUSD",
      },
      {
        name: "Circle",
        logo: si("circle", "063B74"),
        href: "https://www.circle.com",
        blurb: "USDC mint & settlement",
      },
      {
        name: "Banxa",
        logo: brand("banxa.com"),
        href: "https://banxa.com",
        blurb: "Fiat on-ramp deposits",
      },
      {
        name: "Helio",
        logo: brand("hel.io"),
        href: "https://www.hel.io",
        blurb: "Crypto checkout → OUSD",
      },
      {
        name: "Pi Network",
        logo: PI_NETWORK_LOGO_URL,
        blurb: "Pi Browser & Pi top-ups",
      },
      {
        name: "Apple Pay",
        logo: si("applepay", "000000"),
        blurb: "Via MoonPay checkout",
      },
      {
        name: "Google Pay",
        logo: si("googlepay", "4285F4"),
        blurb: "Via MoonPay checkout",
      },
      {
        name: "OpenPay Balance",
        logo: OPENPAY_AUTH_LOGO,
        href: "https://openpy.space",
        blurb: "Network balance → Pro OUSD",
      },
    ],
  },
  {
    id: "wallets",
    title: "Wallets & sign-in",
    blurb: "Enter with the wallet or identity you already use.",
    partners: [
      { name: "OpenPay", logo: OPENPAY_AUTH_LOGO, href: "https://openpy.space", blurb: "Connect with OpenPay" },
      { name: "Phantom", logo: "/phantom-logo.svg", href: "https://phantom.app", blurb: "Solana wallet sign-in" },
      {
        name: "MetaMask",
        logo: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg",
        href: "https://metamask.io",
        blurb: "EVM wallet / Web3Auth",
      },
      { name: "WalletConnect", logo: si("walletconnect", "3B99FC"), href: "https://walletconnect.com", blurb: "Mobile & desktop wallets" },
      { name: "Trust Wallet", logo: brand("trustwallet.com"), href: "https://trustwallet.com", blurb: "Asset deep links" },
      { name: "Telegram", logo: si("telegram", "26A5E4"), href: "https://telegram.org", blurb: "Telegram Login" },
      { name: "Pi Network", logo: PI_NETWORK_LOGO_URL, blurb: "Pi Browser / Pi OAuth" },
      { name: "Web3Auth", logo: brand("web3auth.io"), href: "https://web3auth.io", blurb: "Social & embedded auth" },
    ],
  },
  {
    id: "exchanges",
    title: "Exchange market feeds",
    blurb: "Spot and perpetual quotes powered by major venue symbols.",
    partners: [
      { name: "Binance", logo: si("binance", "F0B90B"), href: "https://www.binance.com", blurb: "Spot · futures symbols" },
      { name: "OKX", logo: si("okx", "000000"), href: "https://www.okx.com", blurb: "Perpetual swap feeds" },
      { name: "Bybit", logo: brand("bybit.com"), href: "https://www.bybit.com", blurb: "Linear perp markets" },
      { name: "Gate.io", logo: brand("gate.io"), href: "https://www.gate.io", blurb: "Futures market map" },
      { name: "TradingView", logo: si("tradingview", "2962FF"), href: "https://www.tradingview.com", blurb: "Chart symbol bridge" },
    ],
  },
  {
    id: "open-network",
    title: "OpenPay network",
    blurb: "First-party products on the same open ledger.",
    partners: [
      { name: "OpenPay", logo: OPENPAY_AUTH_LOGO, href: "https://openpy.space" },
      { name: "OpenUSD", logo: OUSD_LOGO_URL, href: "/openusd" },
      { name: "OpenLedger", logo: OPENPAY_NETWORK_BADGE_URL, href: "https://openpyledger.space" },
      { name: "OpenPay AI", logo: OPENPAY_AI_MENU_ICON, href: "https://www.openpy.space/blog/meet-openpay-ai" },
      { name: "Partner API", logo: OPENPAY_AUTH_LOGO, href: "https://openpy.space/partner-api" },
      { name: "OpenNFT", logo: OPENPAY_NETWORK_BADGE_URL, href: "https://openpy.space/web3/nft" },
    ],
  },
];

/** Live networks shown in wallet filters (excludes “all”). */
export function partnerNetworks(): PartnerMark[] {
  return WALLET_NETWORKS.filter((n) => n.id !== "all" && n.status === "live").map((n) => ({
    name: n.label,
    logo: n.logoUrl ?? (n.id === "openpay" ? OPENPAY_AUTH_LOGO : OUSD_LOGO_URL),
    blurb: "Live in wallet",
  }));
}

const FEATURED_MAJOR_IDS: MajorTokenId[] = [
  "btc",
  "eth",
  "sol",
  "bnb",
  "xrp",
  "usdt",
  "usdc",
  "doge",
  "ada",
  "trx",
  "link",
  "avax",
  "dot",
  "sui",
  "near",
  "gram",
  "pi",
  "wld",
  "jup",
  "uni",
  "aave",
  "pepe",
  "shib",
  "bonk",
  "wbtc",
  "ltc",
  "xlm",
  "atom",
  "arb",
  "op",
  "pol",
  "apt",
  "tao",
  "xmr",
  "pengu",
  "trump",
  "ethfi",
  "tia",
  "hype",
  "ondo",
  "robo",
];

/** Showcase strip of listed majors (logos from the Tokens catalog). */
export function partnerListedTokens(): PartnerMark[] {
  const ids = FEATURED_MAJOR_IDS.filter((id) => id in MAJOR_TOKENS);
  const rest = MAJOR_TOKEN_IDS.filter((id) => !ids.includes(id)).slice(0, 28);
  return [...ids, ...rest].map((id) => {
    const t = MAJOR_TOKENS[id];
    return {
      name: t.symbol,
      logo: t.logoUrl,
      blurb: t.name,
    };
  });
}

/** Spot / Perp market count for marketing copy. */
export function tradeMarketStats() {
  const listed = listedTradeMarkets();
  return {
    total: listed.length,
    spot: listed.filter((m) => m.spot_enabled).length,
    perp: listed.filter((m) => m.perpetual_enabled).length,
    majors: MAJOR_TOKEN_IDS.length,
    networks: WALLET_NETWORKS.filter((n) => n.id !== "all" && n.status === "live").length,
  };
}
