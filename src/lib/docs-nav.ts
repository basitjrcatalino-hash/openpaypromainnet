export type DocsNavItem = {
  label: string;
  href: string;
  desc?: string;
};

export type DocsNavGroup = {
  label: string;
  items: DocsNavItem[];
};

/** Shared Developer Portal navigation — keep in sync with routes under /docs/*. */
export const DOCS_NAV: DocsNavGroup[] = [
  {
    label: "Start here",
    items: [
      { label: "Developer Portal", href: "/docs", desc: "Hub for every integration path" },
      {
        label: "AI Partner Pack",
        href: "/docs/ai",
        desc: "OpenAI · ChatGPT · Cursor · Claude",
      },
      {
        label: "Quickstart",
        href: "/docs#quickstart",
        desc: "Connect + payments in one afternoon",
      },
      { label: "Choose your path", href: "/docs#paths", desc: "Exchange · Merchant · App · Agent" },
    ],
  },
  {
    label: "Core guides",
    items: [
      {
        label: "Connect & payments",
        href: "/docs/openpay",
        desc: "OAuth, PayButton, inbound, auth",
      },
      {
        label: "Pro Pay · Merchant",
        href: "/docs/pro-pay",
        desc: "Checkout, receive wallet, earnings dashboard",
      },
      {
        label: "Pro Connect · Auth & Pay",
        href: "/docs/integrations",
        desc: "Native OAuth + OUSD charges on Pro",
      },
      {
        label: "Exchange · OUSD",
        href: "/docs/exchange",
        desc: "Deposit, withdraw, swap, reconcile",
      },
      {
        label: "Money rails",
        href: "/docs/money",
        desc: "Send, receive, deposit, withdraw, swap",
      },
      {
        label: "Tokens & assets",
        href: "/docs/tokens",
        desc: "OUSD, majors, OpenToken, NFT",
      },
      {
        label: "Authentication",
        href: "/docs/auth",
        desc: "Seven Pro methods + Connect OAuth",
      },
    ],
  },
  {
    label: "APIs",
    items: [
      {
        label: "Partner Transfer API",
        href: "/docs/api",
        desc: "Transfers, charges, OAuth token",
      },
      {
        label: "Pro Connect API",
        href: "/docs/integrations",
        desc: "Auth + Pay endpoints on Pro",
      },
      {
        label: "Public Ledger API",
        href: "/docs/ledger",
        desc: "Append-only transaction mirror",
      },
      {
        label: "Agent Connect · MCP",
        href: "/docs/mcp",
        desc: "Tools for ChatGPT, Claude, agents",
      },
      {
        label: "OpenAPI spec",
        href: "/api/public/docs/openapi",
        desc: "Machine-readable Partner + Pro APIs",
      },
    ],
  },
  {
    label: "Reference",
    items: [
      { label: "FAQ", href: "/docs/faq", desc: "Wallets, fees, partner teaser" },
      {
        label: "Errors & retries",
        href: "/docs/errors",
        desc: "HTTP codes, polling, idempotency",
      },
      {
        label: "AI guide (raw MD)",
        href: "/api/public/docs/ai-partner",
        desc: "Paste into any LLM / agent",
      },
      {
        label: "All raw feeds",
        href: "/docs#raw",
        desc: "Markdown + OpenAPI under /api/public/docs",
      },
      {
        label: "Partner portal",
        href: "https://openpy.space/partner-api",
        desc: "OpenPay apps & opk_live_ keys",
      },
      {
        label: "Pro Partner API",
        href: "/partner-api",
        desc: "Pro Connect apps · opro_live_ / callbacks",
      },
      {
        label: "llms.txt",
        href: "/llms.txt",
        desc: "AI discovery index",
      },
    ],
  },
];

export const DOCS_BASE = "https://openpaypro.space";
export const PARTNER_API =
  "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api";
export const PARTNER_PORTAL = "https://openpy.space/partner-api";
/** OpenPay Pro Connect credentials portal (native Pro apps). */
export const PRO_PARTNER_PORTAL = "https://openpaypro.space/partner-api";
export const CONNECT_URL = "https://openpy.space/connect";
export const LEDGER_API_BASE = "https://openpaypro.space/api/public/ledger";
export const INBOUND_API = "https://openpaypro.space/api/public/openpay/inbound";
export const MCP_URL = "https://openpaypro.space/mcp";
export const OPENAPI_URL = "https://openpaypro.space/api/public/docs/openapi";
export const AI_DOCS_URL = "https://openpaypro.space/docs/ai";
