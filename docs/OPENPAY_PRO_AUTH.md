# OpenPay Pro — Authentication Integration Guide

Complete setup for every sign-in method on **OpenPay Pro** (`/authpi`). Use this to integrate the same auth stack in your own app or to configure a Pro deployment.

|                  |                                                                  |
| ---------------- | ---------------------------------------------------------------- |
| **Sign-in UI**   | [`/authpi`](/authpi)                                             |
| **Live docs**    | [`/docs/openpay#auth`](/docs/openpay#auth)                       |
| **Raw Markdown** | [`/api/public/docs/openpay-auth`](/api/public/docs/openpay-auth) |

---

## Overview — methods on the auth screen

| Method            | Type                                         | Entry                               | Backend                                   |
| ----------------- | -------------------------------------------- | ----------------------------------- | ----------------------------------------- |
| **OpenPay**       | OAuth 2.0 (OpenPay account)                  | `startOpenPaySignIn()`              | `GET/POST /api/public/openpay-auth`       |
| **Solana**        | Sign In With Solana (SIWS)                   | `startSolanaSignIn()`               | `GET/POST /api/public/solana-auth`        |
| **Pi Network**    | Pi Browser SDK or Pi OAuth                   | `signInWithPi()` / Pi authorize URL | `POST /api/public/pi-auth`                |
| **Phantom**       | Phantom Connect (extension · Google · Apple) | Phantom React SDK                   | `/auth/callback`                          |
| **WalletConnect** | EVM SIWE (`personal_sign`)                   | `startWalletConnectSignIn()`        | `GET/POST /api/public/walletconnect-auth` |
| **MetaMask**      | Embedded Wallets / Web3Auth social OAuth     | `@web3auth/modal`                   | `POST /api/public/web3auth-auth`          |

All successful flows end in a **Supabase** session (`signInWithPassword` or Phantom session bridge) and redirect to `/dashboard` (or your `redirectTo`).

```
┌─────────────┐     challenge / OAuth      ┌──────────────────┐
│  /authpi UI │ ─────────────────────────► │ /api/public/*-auth│
└──────┬──────┘                            └────────┬─────────┘
       │ verify signature / code                     │
       │◄────────────────────────────────────────────┘
       │ email + password (derived) or session
       ▼
┌─────────────┐
│  Supabase   │ ──► /dashboard
└─────────────┘
```

---

## Shared environment (server)

Use these across methods (fallbacks are chained in code):

```bash
# Preferred shared secret for deriving deterministic auth passwords
OPENPAY_AUTH_PASSWORD_SECRET="long-random-string"

# Or method-specific overrides
SOLANA_AUTH_PASSWORD_SECRET=""
WALLETCONNECT_AUTH_PASSWORD_SECRET=""
WEB3AUTH_AUTH_PASSWORD_SECRET=""
PI_AUTH_PASSWORD_SECRET=""

# Supabase (required)
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_PUBLISHABLE_KEY="eyJ..."
# Service role for admin.createUser (server only — never VITE_)
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

---

## 1. OpenPay (Connect with OpenPay)

**What it does:** Standard Authorization Code OAuth against OpenPay (`openpy.space`). User approves profile/balance scopes; Pro exchanges the code server-side and provisions a Supabase user.

### Env

```bash
OPENPAY_OAUTH_AUTHORIZE_URL="https://openpy.space/connect"
OPENPAY_OAUTH_CLIENT_ID="your-client-uuid"
OPENPAY_OAUTH_PUBLIC_ORIGIN="https://your-pro-origin.example"
# Partner API key used as client_secret on token exchange (server only)
OPENPAY_PARTNER_API_KEY="opk_live_..."
OPENPAY_PARTNER_API_BASE="https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api"
```

### Portal setup

1. Register an app at [openpy.space/partner-api](https://openpy.space/partner-api).
2. Allowlist exact redirect URIs, e.g. `https://your-origin/auth/openpay/callback`.
3. Keep `opk_live_…` on the server only.

### Flow

1. Client: `GET /api/public/openpay-auth?origin=…` → `{ authorize_url, state }`.
2. Redirect browser to `authorize_url`.
3. Callback: `/auth/openpay/callback?code=…&state=…`.
4. Client posts code to Pro backend; server calls OpenPay `/oauth/token`, then creates/updates Supabase user.
5. Client signs into Supabase → `/dashboard`.

### Client helper

```ts
import { startOpenPaySignIn } from "@/lib/openpay-auth";
await startOpenPaySignIn({ redirectTo: "/dashboard" });
```

### Routes & files

| Path                                    | Role                           |
| --------------------------------------- | ------------------------------ |
| `src/lib/openpay-auth.ts`               | Start OAuth                    |
| `src/routes/api/public/openpay-auth.ts` | Issue authorize URL / exchange |
| `src/routes/auth.openpay.callback.tsx`  | Browser callback               |

Official OpenPay auth tutorial: [openpy.space/openpay-auth](https://openpy.space/openpay-auth).

---

## 2. Solana (Sign In With Solana)

**What it does:** Desktop Phantom (or Wallet Standard SIWS wallets) signs a server-issued challenge. Pro verifies Ed25519 signature and provisions a Supabase user keyed by Solana address.

### Env

```bash
# Uses OPENPAY_AUTH_PASSWORD_SECRET / SOLANA_AUTH_PASSWORD_SECRET / service role fallback
```

### Flow

1. `GET /api/public/solana-auth?origin=…` → SIWS `SolanaSignInInput` (nonce, domain, requestId HMAC).
2. Wallet `signIn` / `signMessage` returns output.
3. `POST /api/public/solana-auth` with `{ input, output }` → verify → `{ email, password, address }`.
4. `supabase.auth.signInWithPassword` → redirect.

### Client helper

```ts
import { startSolanaSignIn } from "@/lib/solana-auth";
await startSolanaSignIn({ redirectTo: "/dashboard" });
```

### Requirements

- Phantom browser extension (or SIWS-capable Wallet Standard wallet) on desktop web.
- Spec: [Sign In With Solana](https://github.com/phantom/sign-in-with-solana).

### Routes & files

| Path                                   | Role               |
| -------------------------------------- | ------------------ |
| `src/lib/solana-auth.ts`               | Client SIWS        |
| `src/lib/solana-auth.server.ts`        | Challenge + verify |
| `src/routes/api/public/solana-auth.ts` | HTTP API           |

---

## 3. Pi Network

**What it does:**

- **Inside Pi Browser:** Pi SDK authentication → Pro validates → Supabase session.
- **Outside Pi Browser:** OAuth redirect to `accounts.pinet.com` → callback `/auth/pi/callback`.

### Env

```bash
VITE_PI_CLIENT_ID="your-pi-oauth-client-id"
# Server validation uses Pi backend helpers + password secret chain
```

### Flow (external browser)

1. Build authorize URL with `client_id`, `redirect_uri=${origin}/auth/pi/callback`, scopes `username wallet_address`.
2. Store `state` in `sessionStorage`.
3. Callback receives access token → `POST /api/public/pi-auth` → Supabase session.

### Flow (Pi Browser)

```ts
import { signInWithPi } from "@/lib/pi-network";
const { username } = await signInWithPi();
```

### Routes & files

| Path                               | Role           |
| ---------------------------------- | -------------- |
| `src/lib/pi-network.ts`            | SDK + session  |
| `src/lib/piSdk.ts`                 | Browser detect |
| `src/routes/api/public/pi-auth.ts` | Validate       |
| `src/routes/auth.pi.callback.tsx`  | OAuth return   |

On Pi Browser, the auth UI shows **only OpenPay + Pi**.

---

## 4. Phantom Connect

**What it does:** Phantom Connect SDK — injected extension, Google, or Apple. OAuth returns to `/auth/callback`.

### Env

```bash
VITE_PHANTOM_APP_ID="your-phantom-portal-app-id"
# Optional override (must be allowlisted in Phantom Portal):
# VITE_PHANTOM_REDIRECT_URL="https://your-origin/auth/callback"
```

### Phantom Portal checklist

Allowlist each origin **and** matching callback:

- `https://your-domain`
- `https://your-domain/auth/callback`
- `http://localhost:PORT` (+ `/auth/callback`) for local dev

App icon / name: configured in `src/lib/phantom.ts` (`PHANTOM_APP_NAME`, `PHANTOM_APP_ICON`).

### Flow

1. User picks **Phantom** on `/authpi`.
2. `PhantomContinueButton` / Google·Apple links via `@phantom/react-sdk`.
3. OAuth completes at `/auth/callback` → session → `/dashboard`.

### Routes & files

| Path                                  | Role                    |
| ------------------------------------- | ----------------------- |
| `src/lib/phantom.ts`                  | App ID, redirect, icons |
| `src/components/phantom-provider.tsx` | SDK provider            |
| `src/components/phantom-auth-*.tsx`   | Continue / OAuth UI     |
| `src/routes/auth.callback.tsx`        | Redirect target         |

Docs: [Phantom Portal configure URLs](https://docs.phantom.com/phantom-portal/configure-urls).

---

## 5. WalletConnect (EVM SIWE)

**What it does:** Connect injected EVM wallet (MetaMask extension, etc.), sign EIP-4361 message, verify on server, Supabase user keyed by checksum address.

> This is **wallet login**, not WalletConnect Pay merchant API. Pay uses a separate project ID / API key.

### Env

```bash
# Auth password secret chain (see Shared environment)

# WalletConnect Pay (optional — payments, not SIWE login)
VITE_WALLETCONNECT_PAY_APP_ID="your-wcp-project-id"
WALLETCONNECT_PAY_API_KEY="wcp_..."   # server only
WALLETCONNECT_PAY_API_BASE="https://api.pay.walletconnect.com"
```

Pay API auth header: `Api-Key` — see [WalletConnect authentication](https://docs.walletconnect.com/api-reference/authentication).

### Flow

1. `GET /api/public/walletconnect-auth?origin=…` → SIWE challenge.
2. `eth_requestAccounts` + `personal_sign`.
3. `POST /api/public/walletconnect-auth` `{ challenge, address, signature }` → verify with `viem` → credentials.
4. Supabase sign-in → redirect.

### Client helper

```ts
import { startWalletConnectSignIn } from "@/lib/walletconnect-auth";
await startWalletConnectSignIn({ redirectTo: "/dashboard" });
```

### Routes & files

| Path                                          | Role                     |
| --------------------------------------------- | ------------------------ |
| `src/lib/walletconnect-auth.ts`               | Client SIWE              |
| `src/lib/walletconnect-auth.server.ts`        | Challenge + verify       |
| `src/routes/api/public/walletconnect-auth.ts` | HTTP API                 |
| `src/lib/walletconnect-pay.ts`                | Pay wallet SDK           |
| `src/lib/walletconnect-pay.server.ts`         | Merchant API (`Api-Key`) |

---

## 6. MetaMask Embedded Wallets (Web3Auth social OAuth)

**What it does:** MetaMask Embedded Wallets modal + social connectors (Google, X, Apple, GitHub, Discord, Facebook). Identity JWT verified via JWKS; Pro provisions Supabase user.

Docs: [OAuth social logins](https://docs.metamask.io/embedded-wallets/authentication/social-logins/oauth/) · [ID token](https://docs.metamask.io/embedded-wallets/authentication/id-token/).

### Env

```bash
# Public (browser)
VITE_WEB3AUTH_CLIENT_ID="BHxxx...your-client-id"

# Server
WEB3AUTH_CLIENT_ID="same-as-above"
WEB3AUTH_CLIENT_SECRET="your-dashboard-secret"   # never VITE_
WEB3AUTH_JWKS_URL="https://api-auth.web3auth.io/.well-known/jwks.json"

# Network: localhost defaults to Sapphire Devnet; production Mainnet
# VITE_WEB3AUTH_NETWORK="devnet" | "mainnet"
```

### Dashboard setup

1. Create project at [developer.metamask.io](https://developer.metamask.io).
2. Enable social connections (X, Apple, GitHub, Reddit, …) under **Social Connections**.
3. Allowlist your origins.
4. Copy Client ID + Client Secret. Put secret on the server only.
5. Enable **Return user data in identity token** if you need email/name in JWT.

### Flow

1. User picks **MetaMask** → Web3Auth `connect()` or `connectTo(AUTH, { authConnection })`.
2. `getAuthTokenInfo()` → identity JWT string.
3. `POST /api/public/web3auth-auth` `{ idToken }` → JWKS verify (`aud` = client ID, `iss` = Web3Auth) → credentials.
4. Supabase sign-in → redirect.

### Social shortcuts (client)

```ts
import { WALLET_CONNECTORS, AUTH_CONNECTION } from "@web3auth/modal";
import { useWeb3AuthConnect } from "@web3auth/modal/react";

const { connectTo } = useWeb3AuthConnect();
await connectTo(WALLET_CONNECTORS.AUTH, {
  authConnection: AUTH_CONNECTION.GOOGLE, // TWITTER | APPLE | GITHUB | DISCORD | FACEBOOK
});
```

### Routes & files

| Path                                        | Role                |
| ------------------------------------------- | ------------------- |
| `src/lib/web3auth-config.ts`                | Client ID + network |
| `src/lib/web3auth-auth.ts`                  | Exchange + Supabase |
| `src/lib/web3auth-auth.server.ts`           | JWKS verify         |
| `src/components/web3auth-provider.tsx`      | Provider            |
| `src/components/metamask-embedded-auth.tsx` | Auth panel UI       |
| `src/routes/api/public/web3auth-auth.ts`    | HTTP API            |

JWKS (social): [api-auth.web3auth.io/.well-known/jwks.json](https://api-auth.web3auth.io/.well-known/jwks.json).

---

## UI integration (`/authpi`)

File: `src/routes/authpi.tsx`

1. User selects a method tile (OpenPay · Solana · Pi · Phantom · WalletConnect · MetaMask).
2. Primary CTA updates (“Continue with …”).
3. Phantom / MetaMask show method-specific panels (Connect buttons + social chips).
4. Pi Browser filters tiles to OpenPay + Pi only.

Brand logos live under `public/auth-*.png` / `auth-pi.jpg` (see `PHANTOM_WALLET_LOGO`, `SOLANA_WALLET_LOGO`, `METAMASK_WALLET_LOGO`, `PI_NETWORK_AUTH_LOGO` in `src/lib/phantom.ts`).

---

## Security checklist

- [ ] Never put `opk_`, `wcp_`, `WEB3AUTH_CLIENT_SECRET`, or Supabase **service role** in `VITE_*` vars.
- [ ] Verify OAuth `state` on every callback.
- [ ] WalletConnect / Solana / Web3Auth: always verify signatures or JWTs **server-side**.
- [ ] Web3Auth: always validate JWT `audience` = your Client ID.
- [ ] Phantom: allowlist every production + preview origin in Phantom Portal.
- [ ] Prefer Sapphire Devnet for localhost Web3Auth; Mainnet for production hosts.
- [ ] Rotate any secret that was committed or pasted into chat.

---

## Quick endpoint map

| Method             | Endpoints                                                                    |
| ------------------ | ---------------------------------------------------------------------------- |
| OpenPay            | `GET/POST /api/public/openpay-auth` · callback `/auth/openpay/callback`      |
| Solana             | `GET/POST /api/public/solana-auth`                                           |
| Pi                 | `POST /api/public/pi-auth` · callback `/auth/pi/callback`                    |
| Phantom            | SDK → `/auth/callback`                                                       |
| WalletConnect SIWE | `GET/POST /api/public/walletconnect-auth`                                    |
| MetaMask Embedded  | `POST /api/public/web3auth-auth`                                             |
| WC Pay (payments)  | Client `@walletconnect/pay` · merchant API via `walletconnect-pay.server.ts` |

---

## Minimal repro — add a method to your fork

1. Add tile in `AUTH_OPTIONS` inside `src/routes/authpi.tsx`.
2. Implement `startXSignIn()` client helper.
3. Add `/api/public/x-auth` with challenge + verify + `supabaseAdmin.auth.admin.createUser`.
4. Return `{ email, password }` and call `supabase.auth.signInWithPassword`.
5. Document env vars here and in `.env` (no secrets in git).

---

_OpenPay Pro auth docs — keep in sync with `/authpi` and `src/routes/api/public/*-auth.ts`._
