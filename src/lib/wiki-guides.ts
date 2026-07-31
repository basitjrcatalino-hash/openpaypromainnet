export type WikiStep = {
  title: string;
  detail: string;
};

export type WikiSection = {
  id: string;
  heading: string;
  body?: string;
  steps?: WikiStep[];
  tips?: string[];
};

export type WikiGuide = {
  slug: string;
  title: string;
  dek: string;
  category:
    | "Start here"
    | "Wallet"
    | "Move money"
    | "Trade"
    | "Discover"
    | "Security"
    | "Developers";
  level: "Beginner" | "Intermediate" | "Advanced";
  minutes: number;
  hero: { from: string; to: string; glyph: string };
  /** In-app deep link after the tutorial */
  tryPath?: string;
  intro: string;
  sections: WikiSection[];
};

export const WIKI_GUIDES: WikiGuide[] = [
  {
    slug: "getting-started",
    title: "Getting started with OpenPay Pro",
    dek: "Create your account, pick a sign-in method, and land on your first Home screen.",
    category: "Start here",
    level: "Beginner",
    minutes: 5,
    hero: { from: "#ab9ff2", to: "#e9e4ff", glyph: "1" },
    tryPath: "/authpi",
    intro:
      "OpenPay Pro is a Phantom-style wallet for OUSD, Pi, major tokens, and NFTs. This walkthrough gets you from the sign-in screen to a working Home balance.",
    sections: [
      {
        id: "choose-signin",
        heading: "Choose how you sign in",
        body: "Open /authpi. You can use OpenPay, email and password, Phantom, Solana, WalletConnect, MetaMask, Pi Network, Telegram, or Privy.",
        steps: [
          { title: "Open the sign-in page", detail: "Go to openpaypro.space/authpi or tap Sign in from any public page." },
          { title: "Pick a method", detail: "Tap a tile under Wallets or Social & network. Featured OpenPay sits at the top." },
          { title: "Complete the provider flow", detail: "Approve the wallet, OAuth, or enter email and password. You return to the dashboard when the session is ready." },
        ],
        tips: [
          "Email works even without a browser extension — create an account or sign in with the same credentials later.",
          "In Pi Browser, only OpenPay and Pi Network are shown for a cleaner path.",
        ],
      },
      {
        id: "first-home",
        heading: "Your first Home screen",
        body: "After sign-in you land on Home. The big number is your total portfolio in the display currency you choose.",
        steps: [
          { title: "Read the balance hero", detail: "Tap the balance to open the currency picker (USD, EUR, PI, and dozens more)." },
          { title: "Use the action row", detail: "Receive, Send, Buy, and Swap sit under the balance — same pattern as Phantom." },
          { title: "Scan Holdings", detail: "Holdings lists OUSD, majors, and OpenTokens you own. Collectibles opens NFTs." },
        ],
      },
      {
        id: "menu",
        heading: "Find every feature in the menu",
        steps: [
          { title: "Open the sidebar", detail: "On mobile tap the menu icon. On desktop the sidebar stays visible." },
          { title: "Core tabs", detail: "Home, Wallet, Deposit, Tokens, OpenToken, History, and Settings." },
          { title: "Extras", detail: "Live Chat, Watchlist, Blog, Wiki, OpenPay AI, and developer tools when Developer mode is on." },
        ],
      },
    ],
  },
  {
    slug: "home-and-balance",
    title: "Home, balance, and wallets",
    dek: "Switch wallets, hide balances, copy your address, and understand what the total includes.",
    category: "Wallet",
    level: "Beginner",
    minutes: 4,
    hero: { from: "#c4b5fd", to: "#f5f3ff", glyph: "H" },
    tryPath: "/dashboard",
    intro:
      "Home is your command center. Everything below the hero is either an action or a holding you can tap into.",
    sections: [
      {
        id: "portfolio",
        heading: "What the total balance means",
        body: "The total adds OUSD, ledger majors (BTC, ETH, SOL, PI, stables), and OpenToken holdings at live or ledger prices.",
        tips: [
          "Prices refresh in the background. Pull to refresh is not required — navigate away and back if a quote looks stale.",
          "Hide balance with the eye icon when you share your screen.",
        ],
      },
      {
        id: "switch-wallet",
        heading: "Switch or manage wallets",
        steps: [
          { title: "Open the wallet switcher", detail: "Tap the wallet name or chevrons in the sidebar header." },
          { title: "Pick another wallet", detail: "Active wallets show their portfolio total. Switching updates Home and Send immediately." },
          { title: "Create or import", detail: "Settings → Wallets lets you create a recovery wallet or import a phrase." },
        ],
      },
      {
        id: "address",
        heading: "Copy your address",
        steps: [
          { title: "Find the truncated address", detail: "Under the balance hero on Home, or in the sidebar under the active wallet." },
          { title: "Tap to copy", detail: "A toast confirms the copy. Use this address only for rails that OpenPay Pro supports for that asset." },
        ],
      },
    ],
  },
  {
    slug: "buy-and-top-up",
    title: "Buy and top up OUSD",
    dek: "Step-by-step: pick an amount, choose a payment method, confirm, and see OUSD credit.",
    category: "Move money",
    level: "Beginner",
    minutes: 6,
    hero: { from: "#a78bfa", to: "#ddd6fe", glyph: "$" },
    tryPath: "/topup",
    intro:
      "Buy (Top up) turns card, Pi, OpenPay balance, Helio/USDC, MoonPay, or vouchers into spendable OUSD on your active wallet.",
    sections: [
      {
        id: "amount",
        heading: "Step 1 — Choose an amount",
        steps: [
          { title: "Open Buy", detail: "From Home tap Buy, or go to Top up in the menu." },
          { title: "Enter OUSD amount", detail: "Type a value or tap a preset ($25, $50, $100…)." },
          { title: "Continue", detail: "You move to the payment method list for that amount." },
        ],
      },
      {
        id: "method",
        heading: "Step 2 — Pick how to pay",
        body: "Available methods are controlled by admin. Common options: OpenPay balance, Pi Network, card/MoonPay, USDC deposit, vouchers.",
        steps: [
          { title: "Select a method tile", detail: "Read the short description under each option." },
          { title: "Review fees", detail: "If a top-up fee is configured, it is shown before you confirm." },
          { title: "Confirm", detail: "Approve the provider sheet, Pi payment, or paste a voucher code when asked." },
        ],
        tips: ["If a method is missing, an admin may have disabled it under Admin · Top Up."],
      },
      {
        id: "credit",
        heading: "Step 3 — Confirm credit",
        steps: [
          { title: "Wait for success", detail: "A toast or success screen appears when OUSD is credited." },
          { title: "Check Home", detail: "OUSD balance and Recent activity update. Open History for the full ledger line." },
        ],
      },
    ],
  },
  {
    slug: "send-money",
    title: "Send: addresses, @usernames, and QR",
    dek: "Select an asset, choose a recipient, confirm the amount, and broadcast the transfer.",
    category: "Move money",
    level: "Beginner",
    minutes: 6,
    hero: { from: "#818cf8", to: "#e0e7ff", glyph: "→" },
    tryPath: "/send",
    intro:
      "Send moves value out of your wallet to another OpenPay Pro user, an OpenPay tag, or an on-chain address depending on the asset.",
    sections: [
      {
        id: "pick-asset",
        heading: "Step 1 — Select the asset",
        steps: [
          { title: "Open Send", detail: "Home → Send, or the Send tab." },
          { title: "Choose from Your tokens", detail: "Pick OUSD, PI, a major, or an OpenToken you hold." },
          { title: "Scan if you have a QR", detail: "Use Scan to fill recipient and optionally amount from a payment QR." },
        ],
      },
      {
        id: "recipient",
        heading: "Step 2 — Enter the recipient",
        steps: [
          { title: "Type @username or address", detail: "OpenPay Pro resolves @handles. Paste a 0x address when sending on-chain-style ledger assets." },
          { title: "OpenPay rail when offered", detail: "For OUSD you can send via the OpenPay network when the recipient is linked." },
          { title: "Add a memo if needed", detail: "Optional note appears in activity for both sides when supported." },
        ],
      },
      {
        id: "confirm-send",
        heading: "Step 3 — Confirm and send",
        steps: [
          { title: "Enter amount", detail: "The UI shows USD (or your display currency) estimate and warns on insufficient balance." },
          { title: "Review the confirm sheet", detail: "Check asset, amount, fee, and destination one last time." },
          { title: "Submit", detail: "Success toast + History entry. The recipient sees a receive notification when alerts are on." },
        ],
      },
    ],
  },
  {
    slug: "receive-and-qr",
    title: "Receive and share your QR",
    dek: "Create a receive link, show your QR, and accept OpenPay or wallet payments.",
    category: "Move money",
    level: "Beginner",
    minutes: 5,
    hero: { from: "#a78bfa", to: "#f3e8ff", glyph: "QR" },
    tryPath: "/receive",
    intro:
      "Receive turns your account into something others can pay — wallet QR, OpenPay receive link, or network-specific deposit address.",
    sections: [
      {
        id: "open-receive",
        heading: "Open Receive",
        steps: [
          { title: "From Home tap Receive", detail: "Or open Receive from the menu / Wallet flows." },
          { title: "Pick the rail", detail: "Wallet address for ledger assets, or OpenPay link when you want Pay @tag style inbound." },
        ],
      },
      {
        id: "share",
        heading: "Share your payment details",
        steps: [
          { title: "Show the QR", detail: "Let the payer scan with their camera or OpenPay Pro Scan." },
          { title: "Copy address or link", detail: "Use Copy for chat apps. Optional amount and note fields fill the QR when set." },
          { title: "Create an OpenPay receive link", detail: "When linked to OpenPay, generate a pay URL others can open in OpenPay." },
        ],
        tips: ["Never reuse a one-time deposit address from another chain — always copy from the Receive screen for that network."],
      },
    ],
  },
  {
    slug: "multi-chain-deposit",
    title: "Multi-chain Deposit gateway",
    dek: "Deposit from Ethereum, Base, BNB, Polygon, Solana, and more — then wait for confirmations.",
    category: "Move money",
    level: "Intermediate",
    minutes: 7,
    hero: { from: "#7c3aed", to: "#ddd6fe", glyph: "⛓" },
    tryPath: "/deposit",
    intro:
      "Deposit watches an address you send to on an external chain, then credits your OpenPay Pro balance after enough confirmations.",
    sections: [
      {
        id: "pick-chain",
        heading: "Step 1 — Choose chain and token",
        steps: [
          { title: "Open Deposit", detail: "Sidebar → Deposit." },
          { title: "Select network", detail: "Pick the chain you will send from (e.g. Base, Ethereum)." },
          { title: "Select token", detail: "Only tokens configured by the operator appear for that chain." },
        ],
      },
      {
        id: "send-out",
        heading: "Step 2 — Send from your external wallet",
        steps: [
          { title: "Copy the deposit address", detail: "Shown with a QR. Double-check the chain matches your wallet network." },
          { title: "Send the exact asset", detail: "Wrong token or chain can result in unrecoverable funds." },
          { title: "Optional: paste tx hash", detail: "Some flows let you submit the hash to speed detection." },
        ],
      },
      {
        id: "confirmations",
        heading: "Step 3 — Wait for credit",
        body: "Status moves through detected → confirming → credited. Required confirmations depend on the chain config.",
        tips: ["Keep the Deposit page open or check History later — credit is automatic once confirmations pass."],
      },
    ],
  },
  {
    slug: "swap-tokens",
    title: "Swap between assets",
    dek: "Trade OUSD and majors with slippage controls — step by step.",
    category: "Trade",
    level: "Intermediate",
    minutes: 5,
    hero: { from: "#8b5cf6", to: "#ede9fe", glyph: "⇄" },
    tryPath: "/swap",
    intro:
      "Swap converts one ledger asset into another inside OpenPay Pro. You stay custodial — no separate DEX wallet required for majors.",
    sections: [
      {
        id: "pair",
        heading: "Choose the pair",
        steps: [
          { title: "Open Swap", detail: "Home → Swap." },
          { title: "Set From and To", detail: "Tap either side to pick tokens. Flip with the switch control." },
          { title: "Enter amount", detail: "Max uses your available balance for the From asset." },
        ],
      },
      {
        id: "slippage",
        heading: "Review quote and slippage",
        steps: [
          { title: "Open settings on the swap card", detail: "Adjust slippage or custom percent if the market is moving." },
          { title: "Confirm", detail: "Review rate, fee, and minimum received, then confirm." },
        ],
      },
    ],
  },
  {
    slug: "opentoken-mint-trade",
    title: "OpenToken: mint and trade",
    dek: "Create a token on the bonding curve, buy early, and watch graduation.",
    category: "Trade",
    level: "Intermediate",
    minutes: 8,
    hero: { from: "#6366f1", to: "#e0e7ff", glyph: "OT" },
    tryPath: "/opentoken",
    intro:
      "OpenToken is the in-wallet launchpad. Creators mint; traders buy and sell against a bonding curve until graduation.",
    sections: [
      {
        id: "browse",
        heading: "Browse and open a token",
        steps: [
          { title: "Open OpenToken", detail: "Sidebar → OpenToken." },
          { title: "Filter or search", detail: "Use category pills and trending rails to find launches." },
          { title: "Open a token page", detail: "Chart, holders, comments, and live chat sit on the token detail." },
        ],
      },
      {
        id: "trade",
        heading: "Buy or sell",
        steps: [
          { title: "Open the trade panel", detail: "Buy / Sell toggle with amount keypad." },
          { title: "Confirm the quote", detail: "Curve price updates as you type. Confirm to execute." },
        ],
      },
      {
        id: "create",
        heading: "Create your own token",
        steps: [
          { title: "Tap Create", detail: "Fill name, symbol, logo, and optional description." },
          { title: "Fair launch confirm", detail: "Pay the mint fee in OUSD and optionally buy an initial amount." },
          { title: "Share the page", detail: "Your token appears in OpenToken lists once minted." },
        ],
      },
    ],
  },
  {
    slug: "nfts-and-collectibles",
    title: "NFTs and collectibles",
    dek: "Browse OpenNFT holdings, mint, and open marketplace links.",
    category: "Discover",
    level: "Beginner",
    minutes: 4,
    hero: { from: "#a855f7", to: "#f3e8ff", glyph: "NFT" },
    tryPath: "/nfts",
    intro:
      "Collectibles on Home and the NFTs page show OpenPay OpenNFT items linked to your connected OpenPay account.",
    sections: [
      {
        id: "view",
        heading: "View your collectibles",
        steps: [
          { title: "Home → Collectibles", detail: "Or open NFTs from the app." },
          { title: "Tap a card", detail: "Opens detail / marketplace permalink when available." },
        ],
      },
      {
        id: "mint",
        heading: "Mint a new collectible",
        steps: [
          { title: "Connect OpenPay in Settings", detail: "Minting requires a linked OpenPay OAuth account." },
          { title: "Open mint", detail: "Follow the mint form and confirm payment." },
        ],
      },
    ],
  },
  {
    slug: "watchlist-and-chat",
    title: "Watchlist and Live Chat",
    dek: "Track tokens you care about and chat with the community.",
    category: "Discover",
    level: "Beginner",
    minutes: 3,
    hero: { from: "#c084fc", to: "#faf5ff", glyph: "★" },
    tryPath: "/watchlist",
    intro: "Watchlist stars assets for quick access. Live Chat is the global room; token pages have their own chat too.",
    sections: [
      {
        id: "watchlist",
        heading: "Use Watchlist",
        steps: [
          { title: "Open Watchlist", detail: "Sidebar → Watchlist." },
          { title: "Add from a token page", detail: "Star an asset on OpenToken or Tokens to pin it here." },
        ],
      },
      {
        id: "chat",
        heading: "Live Chat",
        steps: [
          { title: "Open Live Chat", detail: "Sidebar → Live Chat." },
          { title: "Send a message", detail: "Type, add emoji/GIFs when available, and send. Be respectful — rooms are public." },
        ],
      },
    ],
  },
  {
    slug: "openpay-ai",
    title: "OpenPay AI assistant",
    dek: "Ask product questions and listen to answers with the same text-to-speech used in this Wiki.",
    category: "Discover",
    level: "Beginner",
    minutes: 4,
    hero: { from: "#7c3aed", to: "#ede9fe", glyph: "AI" },
    tryPath: "/ai",
    intro:
      "OpenPay AI answers how-to questions about the wallet. It cannot see your balances or move funds. Tap the speaker to hear replies aloud.",
    sections: [
      {
        id: "ask",
        heading: "Ask a question",
        steps: [
          { title: "Open OpenPay AI", detail: "Sidebar → OpenPay AI." },
          { title: "Tap a suggestion or type", detail: "Examples: how to top up, send to @username, connect ChatGPT." },
          { title: "Read the markdown answer", detail: "Replies stream in. End chat clears the thread." },
        ],
      },
      {
        id: "listen",
        heading: "Listen with text-to-speech",
        steps: [
          { title: "Tap the speaker under an answer", detail: "Uses /api/tts — same engine as Wiki Listen." },
          { title: "Tap again to stop", detail: "Audio stops and the button returns to idle." },
        ],
      },
    ],
  },
  {
    slug: "scan-and-wc-pay",
    title: "Scan QR and WalletConnect Pay",
    dek: "Scan payment QRs and pay WalletConnect Pay merchant links from Pro.",
    category: "Move money",
    level: "Intermediate",
    minutes: 5,
    hero: { from: "#6366f1", to: "#c7d2fe", glyph: "⌁" },
    tryPath: "/scan",
    intro:
      "Scan opens the camera to read OpenPay Pro payment QRs or WalletConnect Pay links, then routes you to Send or WC Pay.",
    sections: [
      {
        id: "scan",
        heading: "Scan a QR",
        steps: [
          { title: "Open Scan", detail: "Allow camera permission when prompted." },
          { title: "Point at the QR", detail: "On success you jump to Send with fields filled, or to WC Pay for merchant links." },
        ],
      },
      {
        id: "wc-pay",
        heading: "Pay a WalletConnect Pay link",
        steps: [
          { title: "Connect an EVM wallet", detail: "Required to sign the payment." },
          { title: "Load options", detail: "Paste or open the pay.walletconnect.com link." },
          { title: "Choose option and sign", detail: "Complete any collect-data step, then confirm in your wallet." },
        ],
      },
    ],
  },
  {
    slug: "settings-security",
    title: "Settings, PIN, and recovery",
    dek: "Secure your account: display name, currency, theme, PIN, biometrics, and recovery phrase.",
    category: "Security",
    level: "Beginner",
    minutes: 6,
    hero: { from: "#6d28d9", to: "#ede9fe", glyph: "⚙" },
    tryPath: "/settings",
    intro:
      "Settings is where identity, wallets, notifications, and security live. Back up your recovery phrase before you need it.",
    sections: [
      {
        id: "profile",
        heading: "Profile and preferences",
        steps: [
          { title: "Edit display name and @username", detail: "Shown on creator pages and some payment UIs." },
          { title: "Set currency and theme", detail: "Light / dark and display currency apply across the app." },
          { title: "Notifications", detail: "Toggle email and in-app tx alerts." },
        ],
      },
      {
        id: "security",
        heading: "PIN, biometrics, recovery",
        steps: [
          { title: "Set a PIN", detail: "Used to gate sensitive actions when enabled." },
          { title: "Reveal recovery phrase", detail: "Write it down offline. Anyone with the phrase can recreate the wallet." },
          { title: "Connect OpenPay / partners", detail: "Link OpenPay OAuth for NFTs and OpenPay balance features." },
        ],
        tips: ["Never screenshot your recovery phrase or paste it into chat apps."],
      },
    ],
  },
  {
    slug: "pi-and-kyc",
    title: "Pi Network sign-in and KYC",
    dek: "Sign in with Pi and complete Pi Verify identity when required.",
    category: "Security",
    level: "Intermediate",
    minutes: 5,
    hero: { from: "#7038A1", to: "#e9d5ff", glyph: "π" },
    tryPath: "/kyc",
    intro:
      "Pi sign-in brings your Pi username into OpenPay Pro. KYC via Pi Verify unlocks higher limits where required.",
    sections: [
      {
        id: "signin-pi",
        heading: "Sign in with Pi",
        steps: [
          { title: "Prefer Pi Browser when possible", detail: "Native SDK auth is smoothest inside Pi Browser." },
          { title: "Or use Pi OAuth on the web", detail: "Complete redirect and return to the dashboard." },
        ],
      },
      {
        id: "kyc",
        heading: "Start KYC",
        steps: [
          { title: "Open KYC", detail: "From Settings or the KYC route." },
          { title: "Follow Pi Verify", detail: "Complete the session until status shows verified." },
        ],
      },
    ],
  },
  {
    slug: "ledger-api",
    title: "Public Ledger API",
    dek: "Browse the append-only ledger in-app and pull it with an API key.",
    category: "Developers",
    level: "Advanced",
    minutes: 6,
    hero: { from: "#4c1d95", to: "#ddd6fe", glyph: "Lg" },
    tryPath: "/ledger",
    intro:
      "Every send, receive, buy, sell, swap, mint, and reward can write a public ledger entry for analytics and OpenLedger pipelines.",
    sections: [
      {
        id: "ui",
        heading: "Use the Ledger screen",
        steps: [
          { title: "Enable Developer mode", detail: "Sidebar toggle → Developer." },
          { title: "Open Ledger API", detail: "Browse entries and copy sync helpers." },
        ],
      },
      {
        id: "api",
        heading: "Call the API",
        body: "Authenticate with x-api-key or Bearer. See /docs/openpay and docs/LEDGER_API.md for endpoints and covered types.",
        tips: ["Never ship service-role keys in the browser."],
      },
    ],
  },
  {
    slug: "agent-connect-mcp",
    title: "Agent Connect and MCP",
    dek: "Expose a read surface to ChatGPT or Claude through Model Context Protocol.",
    category: "Developers",
    level: "Advanced",
    minutes: 7,
    hero: { from: "#5b21b6", to: "#ede9fe", glyph: "MCP" },
    tryPath: "/connect",
    intro:
      "Agent Connect registers your wallet as an MCP server so AI clients can call list-tools / invoke-tool safely.",
    sections: [
      {
        id: "enable",
        heading: "Turn on Developer mode",
        steps: [
          { title: "Toggle Developer in the sidebar", detail: "Agent Connect and docs links appear." },
          { title: "Open Agent Connect", detail: "Copy the MCP URL and follow ChatGPT / Claude connector steps." },
        ],
      },
      {
        id: "clients",
        heading: "Connect a client",
        steps: [
          { title: "ChatGPT advanced connectors", detail: "Paste the MCP URL from the Connect page." },
          { title: "Claude", detail: "Use the prefilled deep link when shown." },
        ],
        tips: ["MCP is read-oriented — it should not move funds without explicit product design."],
      },
    ],
  },
  {
    slug: "currency-and-theme",
    title: "Display currency and theme",
    dek: "Switch fiat/PI display and light or dark Phantom-style chrome.",
    category: "Wallet",
    level: "Beginner",
    minutes: 2,
    hero: { from: "#a78bfa", to: "#f5f3ff", glyph: "¤" },
    tryPath: "/settings",
    intro: "Balances convert from USD via live FX. PI uses the Pi market price. Theme is saved on the device.",
    sections: [
      {
        id: "currency",
        heading: "Change currency",
        steps: [
          { title: "Tap the big balance", detail: "Opens the currency sheet." },
          { title: "Pick a code", detail: "USD, EUR, PI, and many others. Preference can sync to your profile." },
        ],
      },
      {
        id: "theme",
        heading: "Light or dark",
        steps: [
          { title: "Settings → Theme", detail: "Dark is the default Phantom-like look; light is available too." },
        ],
      },
    ],
  },
];

export function getWikiGuide(slug: string): WikiGuide | undefined {
  return WIKI_GUIDES.find((g) => g.slug === slug);
}

export function wikiCategories(): WikiGuide["category"][] {
  const order: WikiGuide["category"][] = [
    "Start here",
    "Wallet",
    "Move money",
    "Trade",
    "Discover",
    "Security",
    "Developers",
  ];
  return order.filter((c) => WIKI_GUIDES.some((g) => g.category === c));
}

/** Flatten a guide into plain text for TTS. */
export function wikiGuideSpeechText(guide: WikiGuide): string {
  const parts: string[] = [guide.title, guide.dek, guide.intro];
  for (const section of guide.sections) {
    parts.push(section.heading);
    if (section.body) parts.push(section.body);
    section.steps?.forEach((s, i) => {
      parts.push(`Step ${i + 1}. ${s.title}. ${s.detail}`);
    });
    section.tips?.forEach((t) => parts.push(`Tip. ${t}`));
  }
  return parts.join(" ");
}
