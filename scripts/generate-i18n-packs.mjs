/**
 * Generates src/i18n/locales/packs.ts — run: node scripts/generate-i18n-packs.mjs
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const en = {
  common: {
    appName: "OpenPay Pro",
    loading: "Loading…",
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    continue: "Continue",
    back: "Back",
    close: "Close",
    done: "Done",
    search: "Search",
    copy: "Copy",
    copied: "Copied",
    max: "Max",
    next: "Next",
    error: "Something went wrong",
    retry: "Retry",
    signOut: "Sign out",
    active: "Active",
    amount: "Amount",
    balance: "Balance",
    wallet: "Wallet",
    learnMore: "Learn more",
    notFound: "Page not found",
    notFoundDesc: "That route doesn't exist in OpenPay Pro Wallet.",
    goHome: "Go home",
  },
  nav: {
    home: "Home",
    wallet: "Wallet",
    tokens: "Tokens",
    openToken: "OpenToken",
    history: "History",
    settings: "Settings",
    liveChat: "Live Chat",
    watchlist: "Watchlist",
    ledgerApi: "Ledger API",
    docs: "OpenPay Docs",
    faq: "FAQ",
    nfts: "Collectibles",
    send: "Send",
    receive: "Receive",
    swap: "Swap",
    buy: "Buy",
    scan: "Scan",
    deposit: "Deposit",
    blog: "Blog",
    wiki: "Wiki",
    about: "About",
    website: "Website",
    ousd: "OpenUSD",
    explore: "Explore",
    discover: "Discover",
    ai: "OpenPay AI",
    developer: "Developer",
    agentConnect: "Agent Connect",
    depositGateway: "Deposit gateway",
  },
  language: {
    title: "Display Language",
    subtitle: "Choose your OpenPay Pro language",
    searchPlaceholder: "Search languages",
    updated: "Language updated",
    current: "Current language",
    noResults: "No languages found",
  },
  settings: {
    title: "Settings",
    account: "Account",
    wallets: "Wallets",
    security: "Security",
    preferences: "Preferences",
    connected: "Connected",
    legal: "Legal",
    theme: "Theme",
    themeDesc: "Choose how OpenPay looks",
    light: "Light",
    dark: "Dark",
    currency: "Currency",
    currencyDesc: "Display fiat values in",
    language: "Language",
    languageDesc: "Interface language",
    priceAlerts: "Price alerts",
    priceAlertsDesc: "Notify on big moves",
    txAlerts: "Transaction alerts",
    txAlertsDesc: "Notify on send, receive and top-ups",
    lockPush: "Lock-screen push",
    lockPushDesc: "System notifications when phone is locked or app is closed",
    emailAlerts: "Email alerts",
    emailAlertsDesc: "Email when you receive or send funds",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    regulatory: "Regulatory",
    signOutConfirm: "Sign out of OpenPay Pro?",
    profile: "Profile",
    editProfile: "Edit profile",
    manageWallets: "Manage wallets",
    biometric: "Biometric unlock",
    pin: "PIN",
    recovery: "Recovery phrase",
  },
  dashboard: {
    title: "Home",
    tokens: "Tokens",
    collectibles: "Collectibles",
    activity: "Recent activity",
    seeAll: "See all",
    send: "Send",
    receive: "Receive",
    swap: "Swap",
    buy: "Buy",
    emptyTokens: "No tokens yet",
    emptyActivity: "No activity yet",
  },
  buy: {
    title: "Buy",
    addOusd: "Add OUSD to your wallet",
    amount: "Amount",
    payWith: "Pay with",
    openpayBalance: "OpenPay Balance",
    openpayDesc: "Pay from your connected OpenPay account · real debit",
    moonpay: "MoonPay",
    moonpayDesc: "Card / Apple Pay / Google Pay · MoonPay → OUSD",
    pi: "Pi Network (π)",
    piDesc: "Pay with Pi · live π price → OUSD ($1) credited instantly",
    usdc: "USDC Pay",
    usdcDesc: "Pay with USDC · MoonPay Commerce → OUSD",
    crypto: "Crypto Deposit",
    cryptoDesc: "SOL / crypto · MoonPay Commerce → OUSD",
    confirmTitle: "Confirm top-up",
    confirmDesc: "Review your OUSD purchase",
    youPay: "You pay",
    rateNote: "1 OUSD = $1.00 · credited to your active wallet",
    payOpenPay: "Pay {{amount}} with OpenPay",
    buyMoonPay: "Buy with MoonPay · {{amount}}",
    depositCrypto: "Deposit {{amount}} crypto",
    payUsdc: "Pay {{amount}} with USDC",
    topUp: "Top up {{amount}}",
    connectOpenPay: "Connect OpenPay to continue",
  },
  wallet: {
    title: "Wallet",
    mainWallet: "Main Wallet",
    myWallet: "My Wallet",
    switched: "Wallet switched",
    receive: "Receive",
    send: "Send",
    ousd: "OUSD",
  },
  send: {
    title: "Send",
    to: "To",
    from: "From",
    review: "Review",
    confirm: "Confirm send",
  },
  receive: {
    title: "Receive",
    shareAddress: "Share your address",
    copyAddress: "Copy address",
  },
  swap: {
    title: "Swap",
    youPay: "You pay",
    youReceive: "You receive",
    confirm: "Confirm swap",
  },
  auth: { signIn: "Sign in", welcome: "Welcome to OpenPay Pro" },
  tx: {
    confirm: "Confirm",
    success: "Success",
    pending: "Pending",
    failed: "Failed",
  },
  deposit: { title: "Deposit" },
  scan: {
    title: "Scan",
    hint: "Scan OpenPay Pro receive QR — any Pro token",
  },
  ai: {
    title: "OpenPay AI",
    endChat: "End chat",
    messagePlaceholder: "Message…",
    disclaimer:
      "Responses may not always be accurate. OpenPay AI is trained on OpenPay Pro and OpenPay features — it cannot see your balances or move funds.",
  },
  blog: { title: "Blog" },
  wiki: { title: "Wiki" },
};

function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

function apply(base, patch) {
  const out = deepClone(base);
  for (const [ns, vals] of Object.entries(patch)) {
    out[ns] = { ...out[ns], ...vals };
  }
  return out;
}

/** Import prebuilt JSON packs written alongside this script */
import { readFileSync, existsSync } from "fs";

const packsPath = join(__dirname, "i18n-packs-data.json");
let packs = { en };

if (existsSync(packsPath)) {
  const data = JSON.parse(readFileSync(packsPath, "utf8"));
  for (const [code, patch] of Object.entries(data)) {
    packs[code] = apply(en, patch);
  }
  packs.en = en;
} else {
  console.warn("Missing i18n-packs-data.json — writing English-only packs");
}

const codes = Object.keys(packs).sort();
const outPath = join(root, "src/i18n/locales/packs.ts");
const out = `/* Auto-generated by scripts/generate-i18n-packs.mjs */
import type { TranslationSchema } from "./en";

export const localePacks = ${JSON.stringify(packs, null, 2)} as unknown as Record<string, TranslationSchema>;

export const localeCodes = ${JSON.stringify(codes)} as const;
`;

writeFileSync(outPath, out, "utf8");
console.log("Wrote", outPath, "locales:", codes.join(", "));
