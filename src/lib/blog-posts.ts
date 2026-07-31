export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "steps"; items: string[] };

export type BlogSection = {
  id: string;
  heading: string;
  blocks: BlogBlock[];
};

export type BlogPost = {
  slug: string;
  title: string;
  dek: string;
  author: string;
  date: string; // ISO
  level: "Beginner" | "Intermediate" | "Advanced";
  category: string;
  readMinutes: number;
  hero: { from: string; to: string; glyph: string };
  intro: string[];
  sections: BlogSection[];
};

const A = "OpenPay Pro Team";

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "what-is-openpay-pro",
    title: "What OpenPay Pro Is, and What It Actually Does With Your Money",
    dek: "A plain-language tour of the wallet: balances, rails, and the pieces that connect Pi, OpenPay, and multi-chain crypto in one account.",
    author: A,
    date: "2026-07-31",
    level: "Beginner",
    category: "Overview",
    readMinutes: 6,
    hero: { from: "#ab9ff2", to: "#e9e4ff", glyph: "OP" },
    intro: [
      "OpenPay Pro is a single account that holds your OUSD balance, your Pi identity, and your on-chain assets side by side. Instead of juggling an exchange, a wallet extension, and a payment app, everything settles into one balance you can spend, send, or withdraw.",
      "This post walks through the parts of the product and how they fit together, so the rest of the feature guides make sense.",
    ],
    sections: [
      {
        id: "the-account",
        heading: "One account, three identities",
        blocks: [
          {
            type: "p",
            text: "Every OpenPay Pro account carries three ways to be recognised: a wallet address for on-chain transfers, an @username handle for people-friendly payments, and a Pi username when you sign in through Pi Network. All three point at the same balance.",
          },
          {
            type: "list",
            items: [
              "Wallet address — used for crypto deposits and withdrawals",
              "@username — used for instant internal transfers, no address required",
              "Pi username — carried over automatically from Pi sign-in",
            ],
          },
        ],
      },
      {
        id: "the-balance",
        heading: "The balance is a ledger, not a number",
        blocks: [
          {
            type: "p",
            text: "New accounts start at zero. Every movement — top up, transfer, buy, deposit, fee — writes a ledger entry that you can inspect, export, or pull through the public Ledger API. Nothing is credited without a matching record.",
          },
          {
            type: "quote",
            text: "If a balance changed and there is no ledger entry, that is a bug, not a feature.",
          },
        ],
      },
      {
        id: "the-rails",
        heading: "The rails money moves on",
        blocks: [
          {
            type: "p",
            text: "OpenPay Pro is deliberately multi-rail. Which one you use depends on where the money is coming from.",
          },
          {
            type: "list",
            items: [
              "OpenPay balance and Pay @tag transfers for the OpenPay network",
              "Multi-chain deposits for EVM chains and Solana",
              "Card and provider checkout for buying crypto directly",
              "Pi Network for Pi-native flows and rewards",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "topping-up-your-balance",
    title: "Topping Up: Every Way to Get Money Into OpenPay Pro",
    dek: "Providers, vouchers, and admin-controlled payment methods — how a top up becomes spendable balance and what to do when it stalls.",
    author: A,
    date: "2026-07-24",
    level: "Beginner",
    category: "Wallet",
    readMinutes: 5,
    hero: { from: "#8ee4c0", to: "#e6fff5", glyph: "↑" },
    intro: [
      "Top Up is the front door of the wallet. It is also the screen with the most moving parts, because the list of payment methods is not fixed — it is configured, ordered, and toggled by the operator.",
    ],
    sections: [
      {
        id: "choose-a-method",
        heading: "Choosing a payment method",
        blocks: [
          {
            type: "p",
            text: "The methods you see on Top Up are read live from configuration. That means a provider can be renamed, reordered, hidden for maintenance, or introduced without an app update.",
          },
          {
            type: "list",
            items: [
              "OpenPay Balance — pay from a linked OpenPay account",
              "Crypto Deposit — send funds on a supported chain",
              "Provider checkout — card and local payment methods",
              "Pi Network — Pi-native payment flow",
            ],
          },
        ],
      },
      {
        id: "vouchers",
        heading: "Vouchers and redemption",
        blocks: [
          {
            type: "p",
            text: "For assisted or offline flows, an operator issues a voucher for a fixed amount. You pay through the published link, receive the code, and redeem it in the wallet.",
          },
          {
            type: "steps",
            items: [
              "Open Top Up and pick the voucher method",
              "Complete payment using the published payment link",
              "Enter the voucher code you receive",
              "The balance credits immediately and writes a ledger entry",
            ],
          },
        ],
      },
      {
        id: "when-it-stalls",
        heading: "When a top up looks stuck",
        blocks: [
          {
            type: "p",
            text: "Most stalled top ups are pending confirmations rather than lost funds. Reconciliation runs automatically, and the Receive screen exposes a manual reconcile action that re-checks the provider for a matching payment.",
          },
        ],
      },
    ],
  },
  {
    slug: "sending-and-receiving",
    title: "Sending and Receiving: Addresses, @Usernames, and QR",
    dek: "Three ways to move value out of your wallet, and how the Receive screen turns your account into something anyone can pay.",
    author: A,
    date: "2026-07-18",
    level: "Beginner",
    category: "Wallet",
    readMinutes: 5,
    hero: { from: "#a5b4ff", to: "#eef1ff", glyph: "⇄" },
    intro: [
      "Payments only feel modern when you stop typing addresses. OpenPay Pro accepts a wallet address when you need precision, and a username when you do not.",
    ],
    sections: [
      {
        id: "send",
        heading: "Three accepted recipient formats",
        blocks: [
          {
            type: "list",
            items: [
              "0x… wallet address for on-chain transfers",
              "@username for instant internal transfers",
              "Pi username for people who joined through Pi sign-in",
            ],
          },
          {
            type: "p",
            text: "The Send screen resolves whichever you paste, shows the matched account before you confirm, and refuses ambiguous input rather than guessing.",
          },
        ],
      },
      {
        id: "receive",
        heading: "Receive is a shareable page, not just an address",
        blocks: [
          {
            type: "p",
            text: "Receive generates a QR code and a copyable address, plus an OpenPay link so someone on the OpenPay network can push OUSD to your Pro wallet on the same rail as a Pay @tag.",
          },
          {
            type: "p",
            text: "Inbound payments poll automatically. If a sender confirms on their side but nothing appears, reconcile manually from the same screen.",
          },
        ],
      },
      {
        id: "scanning",
        heading: "Scanning in restricted environments",
        blocks: [
          {
            type: "p",
            text: "Camera access is blocked inside some in-app browsers and embedded frames. The scanner falls back to scanning a photo from your library, or opening the wallet in a full browser tab where the camera permission can be granted.",
          },
        ],
      },
    ],
  },
  {
    slug: "multi-chain-deposit-gateway",
    title: "The Multi-Chain Deposit Gateway, Explained",
    dek: "How a transaction on Ethereum, Base, BNB Chain, Polygon, or Solana becomes confirmed balance inside OpenPay Pro.",
    author: A,
    date: "2026-07-12",
    level: "Intermediate",
    category: "Crypto",
    readMinutes: 7,
    hero: { from: "#7dd3fc", to: "#e0f2fe", glyph: "⛓" },
    intro: [
      "Crypto deposits look simple from the outside: send coins, see balance. Underneath, the gateway has to watch several chains, verify a transaction actually landed, and credit exactly once.",
    ],
    sections: [
      {
        id: "address",
        heading: "A deposit address per chain",
        blocks: [
          {
            type: "p",
            text: "Pick a chain and an asset, and the gateway shows the deposit address and QR for that network. Addresses are chain-scoped on purpose — sending an asset on the wrong network is the single most common way to lose funds.",
          },
        ],
      },
      {
        id: "verification",
        heading: "Verification and confirmations",
        blocks: [
          {
            type: "p",
            text: "The verifier reads the transaction from the chain itself: the recipient, the amount, the token contract, and the confirmation depth. Only when all four match the expected deposit does the credit happen.",
          },
          {
            type: "list",
            items: [
              "EVM chains verified through receipt and transfer logs",
              "Solana verified through the confirmed transaction record",
              "Idempotent crediting so a replayed transaction hash cannot double-credit",
            ],
          },
        ],
      },
      {
        id: "tracking",
        heading: "Tracking a deposit",
        blocks: [
          {
            type: "p",
            text: "Every deposit shows a status you can follow: detected, confirming, credited, or needs review. The transaction hash is linked, so you can always compare the wallet's view to the chain's view.",
          },
        ],
      },
    ],
  },
  {
    slug: "payment-gateway-for-merchants",
    title: "Accepting Crypto Payments: The Merchant Gateway",
    dek: "Invoices, hosted checkout, API keys, and webhooks — the merchant side of OpenPay Pro in one guide.",
    author: A,
    date: "2026-07-05",
    level: "Advanced",
    category: "Merchants",
    readMinutes: 8,
    hero: { from: "#fbbf6b", to: "#fff2dd", glyph: "$" },
    intro: [
      "If the deposit gateway is how you fund yourself, the payment gateway is how you get paid by other people. It turns an amount into a hosted checkout page a customer can pay from any supported chain.",
    ],
    sections: [
      {
        id: "invoices",
        heading: "Invoices and hosted checkout",
        blocks: [
          {
            type: "p",
            text: "Create an invoice with an amount, a currency, and an optional reference. The gateway returns a public checkout URL with a payment token. The customer picks an asset, sends the payment, and the page tracks confirmation in real time.",
          },
        ],
      },
      {
        id: "settlement",
        heading: "Settlement rules",
        blocks: [
          {
            type: "list",
            items: [
              "Underpayments are recorded and never silently marked as paid",
              "Overpayments credit the full received amount",
              "Late payments after expiry are flagged for review rather than dropped",
            ],
          },
        ],
      },
      {
        id: "webhooks",
        heading: "API keys and webhooks",
        blocks: [
          {
            type: "p",
            text: "Merchants generate scoped API keys from the merchant dashboard and register a webhook URL. Every status change posts a signed payload; verify the signature before acting on it, and treat delivery as at-least-once.",
          },
          {
            type: "steps",
            items: [
              "Create an API key in the merchant dashboard",
              "Register your webhook endpoint",
              "Verify the signature on every request",
              "Mark the order paid only after a confirmed status",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "openpay-ai-assistant",
    title: "OpenPay AI: A Wallet Assistant That Knows the Product",
    dek: "The in-app assistant is trained on OpenPay and OpenPay Pro features, speaks in markdown, and can read answers out loud.",
    author: A,
    date: "2026-06-28",
    level: "Beginner",
    category: "AI",
    readMinutes: 4,
    hero: { from: "#c4b5fd", to: "#f3f0ff", glyph: "AI" },
    intro: [
      "Most wallet support is a search box over a help centre. OpenPay AI is a conversation with something that already understands top ups, transfers, KYC, deposits, and the merchant gateway.",
    ],
    sections: [
      {
        id: "what-it-knows",
        heading: "What it knows and what it does not",
        blocks: [
          {
            type: "p",
            text: "The assistant is grounded in product knowledge: how features work, what a status means, which screen to use. It does not read your balances or move money — anything financial stays behind your own authenticated session.",
          },
        ],
      },
      {
        id: "reading-aloud",
        heading: "Text to speech",
        blocks: [
          {
            type: "p",
            text: "Any answer can be played back as audio, which makes long explanations easier to follow on mobile while you are working through a flow in another tab.",
          },
        ],
      },
    ],
  },
  {
    slug: "pi-network-sign-in-and-kyc",
    title: "Pi Sign-In and Pi Verify KYC",
    dek: "How Pi identity flows into OpenPay Pro, and what happens during a KYC session from creation to verified.",
    author: A,
    date: "2026-06-20",
    level: "Intermediate",
    category: "Identity",
    readMinutes: 6,
    hero: { from: "#fda4af", to: "#ffe9ec", glyph: "π" },
    intro: [
      "Pi Network users do not need a separate identity in OpenPay Pro. Signing in with Pi carries the Pi username through to the wallet, and Pi Verify handles the compliance step.",
    ],
    sections: [
      {
        id: "sign-in",
        heading: "Sign in with Pi",
        blocks: [
          {
            type: "p",
            text: "The wallet uses the Pi sign-in flow with a registered redirect URI. Once the callback completes, the session is established and the Pi username becomes your handle inside the app.",
          },
        ],
      },
      {
        id: "kyc",
        heading: "The KYC session lifecycle",
        blocks: [
          {
            type: "steps",
            items: [
              "Start verification from the KYC screen — a session is created",
              "Complete document and liveness checks with the verification provider",
              "The provider posts the result back to a signed webhook",
              "Your status updates to verified, with a timestamp stored on your profile",
            ],
          },
          {
            type: "p",
            text: "Statuses are honest: pending stays pending until the provider says otherwise, and a rejection explains that you can retry rather than silently failing.",
          },
        ],
      },
    ],
  },
  {
    slug: "public-ledger-and-api",
    title: "The Public Ledger and How to Integrate It",
    dek: "Every transaction writes an entry. Here is what the ledger records, how to browse it, and how to pull it into your own system.",
    author: A,
    date: "2026-06-14",
    level: "Advanced",
    category: "Developers",
    readMinutes: 7,
    hero: { from: "#93c5fd", to: "#e8f1ff", glyph: "≡" },
    intro: [
      "A wallet that cannot show its work is asking for trust it has not earned. The OpenPay Pro ledger records every movement as an immutable entry with a stable identifier.",
    ],
    sections: [
      {
        id: "entries",
        heading: "What an entry contains",
        blocks: [
          {
            type: "list",
            items: [
              "A stable entry ID you can link to and cite",
              "The type of movement: top up, transfer, deposit, buy, fee",
              "Amount, asset, and timestamp",
              "A reference to the underlying transaction where one exists",
            ],
          },
        ],
      },
      {
        id: "browsing",
        heading: "Browsing entries",
        blocks: [
          {
            type: "p",
            text: "Entries are viewable in the app and link out to the public explorer, so a single transaction can be opened, shared, and independently checked.",
          },
        ],
      },
      {
        id: "api",
        heading: "Pulling the ledger into your own system",
        blocks: [
          {
            type: "p",
            text: "Public endpoints expose entries and aggregate stats. Poll for new entries, paginate through history, and reconcile against your own books. The API is read-only by design — nothing on that surface can move funds.",
          },
        ],
      },
    ],
  },
  {
    slug: "tokens-minting-and-trading",
    title: "Minting and Trading Tokens Inside the Wallet",
    dek: "Create a token, set its supply and behaviour, and watch it trade — without leaving OpenPay Pro.",
    author: A,
    date: "2026-06-07",
    level: "Intermediate",
    category: "Tokens",
    readMinutes: 6,
    hero: { from: "#86efac", to: "#eafff1", glyph: "◎" },
    intro: [
      "Token creation is usually a developer task. The mint flow turns it into a form: name, symbol, image, supply, and a handful of behaviour switches, with a live preview of the result.",
    ],
    sections: [
      {
        id: "create",
        heading: "Creating a token",
        blocks: [
          {
            type: "p",
            text: "The create screen mirrors what launch platforms popularised: identity on the left, a live card preview on the right, and feature toggles that map directly to on-chain and database flags.",
          },
        ],
      },
      {
        id: "trade",
        heading: "Trading, holders, and chat",
        blocks: [
          {
            type: "p",
            text: "Each token gets a detail page with price, holders, activity, and a live chat room for the community around it. Watchlists let you follow tokens without holding them.",
          },
        ],
      },
      {
        id: "nfts",
        heading: "NFTs",
        blocks: [
          {
            type: "p",
            text: "The same minting pipeline handles NFTs, with metadata and media handled at upload time so the collectible renders correctly everywhere it appears.",
          },
        ],
      },
    ],
  },
  {
    slug: "security-biometrics-pin-recovery",
    title: "Security: Biometrics, PIN Codes, and Recovery Phrases",
    dek: "Three layers of protection, what each one actually defends against, and how to set them up properly.",
    author: A,
    date: "2026-05-30",
    level: "Beginner",
    category: "Security",
    readMinutes: 5,
    hero: { from: "#fca5a5", to: "#ffeaea", glyph: "⛨" },
    intro: [
      "Security features are only useful if you understand what they protect. These three cover different threats, which is why the wallet offers all of them.",
    ],
    sections: [
      {
        id: "biometrics",
        heading: "Biometric login",
        blocks: [
          {
            type: "p",
            text: "Built on WebAuthn, biometric login binds a credential to your device. It defends against someone who has your password but not your phone, and it removes the habit of typing credentials into whatever browser you happen to be in.",
          },
        ],
      },
      {
        id: "pin",
        heading: "PIN code",
        blocks: [
          {
            type: "p",
            text: "The PIN protects sensitive actions on an already-unlocked device. It is stored only as a hash — the wallet never keeps the digits themselves and cannot recover them for you.",
          },
        ],
      },
      {
        id: "recovery",
        heading: "Recovery phrase",
        blocks: [
          {
            type: "p",
            text: "A twelve-word phrase is your last line of defence. Write it down offline, never paste it into a chat or a form, and treat anyone asking for it as an attacker.",
          },
          {
            type: "quote",
            text: "Support will never ask for your recovery phrase, your PIN, or a code sent to your device.",
          },
        ],
      },
    ],
  },
  {
    slug: "agent-integrations-mcp",
    title: "Connecting AI Agents With MCP",
    dek: "Expose your wallet's read surface to ChatGPT or Claude through a Model Context Protocol server, safely.",
    author: A,
    date: "2026-05-22",
    level: "Advanced",
    category: "Developers",
    readMinutes: 6,
    hero: { from: "#d8b4fe", to: "#f7f0ff", glyph: "⌘" },
    intro: [
      "Agent integrations let an assistant answer questions about your account without you copying data into a chat window. OpenPay Pro ships an MCP server for exactly this.",
    ],
    sections: [
      {
        id: "what-it-exposes",
        heading: "What the server exposes",
        blocks: [
          {
            type: "list",
            items: [
              "Profile basics",
              "Wallets and balances",
              "Transaction history",
              "Ledger entries",
            ],
          },
          {
            type: "p",
            text: "The surface is intentionally read-oriented. An agent can explain your account; it cannot empty it.",
          },
        ],
      },
      {
        id: "auth",
        heading: "Authorisation",
        blocks: [
          {
            type: "p",
            text: "Connections are authorised with OAuth 2.1. You approve the client explicitly, and you can revoke it at any time from the connection screen.",
          },
        ],
      },
    ],
  },
  {
    slug: "admin-controls",
    title: "Operator Controls: Payment Methods, Vouchers, and the Deposit Queue",
    dek: "What an administrator can configure without shipping code — and why that matters for uptime.",
    author: A,
    date: "2026-05-15",
    level: "Intermediate",
    category: "Operations",
    readMinutes: 5,
    hero: { from: "#a8a29e", to: "#f5f5f4", glyph: "⚙" },
    intro: [
      "Payment providers go down. Fees change. Regions open and close. If every one of those needs a release, the product is fragile. OpenPay Pro pushes those decisions into configuration.",
    ],
    sections: [
      {
        id: "methods",
        heading: "Payment method configuration",
        blocks: [
          {
            type: "p",
            text: "Each payment method can be shown or hidden, renamed, described, and reordered. The same configuration drives both the Top Up screen and the buy-token payment sheet, so the two never disagree.",
          },
        ],
      },
      {
        id: "vouchers",
        heading: "Voucher issuance",
        blocks: [
          {
            type: "p",
            text: "Administrators create vouchers for specific amounts and hand them to customers after payment. Redemption is single-use and writes a ledger entry like any other credit.",
          },
        ],
      },
      {
        id: "queue",
        heading: "The deposit review queue",
        blocks: [
          {
            type: "p",
            text: "Deposits that fail automatic verification land in a queue rather than disappearing. An operator can inspect the chain data and resolve them, which keeps edge cases visible instead of silent.",
          },
        ],
      },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function formatBlogDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
