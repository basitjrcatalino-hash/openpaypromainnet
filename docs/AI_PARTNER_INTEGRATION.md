# OpenPay + OpenPay Pro — AI Partner Integration Pack

**Audience:** third-party partners and AI coding agents (OpenAI, ChatGPT, Cursor, Lovable, Replit, Claude, Copilot).

Paste this file (or fetch the live URLs below) into your AI tool, then ask it to implement Connect, payments, payouts, top-up, inbound, or ledger reconcile.

| Resource | URL |
| --- | --- |
| Live AI guide | https://openpaypro.space/docs/ai |
| This markdown (raw) | https://openpaypro.space/api/public/docs/ai-partner |
| `llms.txt` index | https://openpaypro.space/llms.txt |
| Full AI dump | https://openpaypro.space/llms-full.txt |
| OpenAPI | https://openpaypro.space/api/public/docs/openapi |
| Partner keys portal | https://openpy.space/partner-api |
| Developer Portal | https://openpaypro.space/docs |

---

## Canonical bases (do not invent)

```
OpenPay app:           https://openpy.space
Partner portal:        https://openpy.space/partner-api
Connect authorize:     https://openpy.space/connect
PayButton UI:          https://openpy.space/paybutton/{CHARGE_ID}
Hosted pay:            https://openpy.space/pay/{USERNAME}
Partner Transfer API:  https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api
OpenPay Pro:           https://openpaypro.space
Pro inbound:           POST https://openpaypro.space/api/public/openpay/inbound
Ledger API:            https://openpaypro.space/api/public/ledger
MCP:                   https://openpaypro.space/mcp
```

Currency for Partner Transfer charges/transfers: **OUSD**.

---

## Keys & tokens (never mix them up)

| Prefix / form | Who issues | Use |
| --- | --- | --- |
| `opk_live_…` | Partner portal | Server-only partner key. Auth for `/me`, `/balance`, `/accounts`, `/transfers`, `/charges`, OAuth `client_secret`. Also valid for Pro inbound (master scope). |
| `opa_live_…` | `POST /oauth/token` | End-user Connect token. Only `/user/me` and `/user/balance`. |
| `opdk_…` | OpenPay Pro `/developer` | Pro developer key — scoped inbound credit for that Pro user. |
| Ledger key | Pro admin / `LEDGER_MASTER_API_KEY` | Public Ledger API (`x-api-key` or Bearer). |

**Rules**

1. Never put `opk_live_…` in browsers, mobile apps, Lovable client env, or public repos.
2. OAuth `redirect_uri` must **exact-match** the Partner portal allowlist (no trailing slash).
3. Every payout / inbound credit needs idempotency (`Idempotency-Key` or unique `openpay_tx_id`).
4. **No partner payment webhooks** for charges — **poll** `GET /charges/:id` (TTL ~2 hours).
5. OUSD is a **ledger/network asset**, not a public EVM/SPL contract address.

---

## Feature map — what to build

| Feature | Integration |
| --- | --- |
| **Auth / Connect** | OAuth 2.0 Authorization Code → `opa_live_…` → `/user/me` |
| **Checkout / Pay** | `POST /charges` → redirect `checkout_url` → poll until `paid` |
| **Hosted pay link** | `https://openpy.space/pay/@tag?amount=&note=&success_url=&cancel_url=` |
| **Payout / withdraw** | Resolve account → `POST /transfers` with `Idempotency-Key` |
| **Account resolve** | `GET /accounts/:id` (`@user` \| `OP…` \| email) — prefer `OP…` |
| **OpenPay → Pro credit** | Pay with note `pro_xfer:@proUser:ref` → `POST …/inbound` |
| **Pro → OpenPay send** | Pro app uses Partner `/transfers` |
| **Top-up (product UX)** | Deep-link `https://openpaypro.space/topup` (Pi, MoonPay, Helio, Solana Pay, Banxa, Circle, OpenPay Balance, scan-pay, wallet majors) |
| **Deposit / receive** | `/deposit`, `/receive`, `/pay/$to` deep links |
| **Swap** | Deep-link `/swap` · reconcile Ledger `type=swap` |
| **Reconcile** | Poll charges + Ledger `GET /entries` |
| **AI agents (read-only)** | MCP URL — profile, wallets, txs, ledger (no money move) |

Pro end-user sign-in methods (product, not Partner Transfer): OpenPay, Telegram, Solana SIWS, Pi, Phantom, WalletConnect SIWE, MetaMask/Web3Auth, optional Privy/email. Full setup: `/api/public/docs/openpay-auth`.

---

## 1. Setup (5 minutes)

1. Open https://openpy.space/partner-api → register app.
2. Save `client_id` (UUID) and `opk_live_…` (shown once) in **server** secrets.
3. Register exact redirect URIs, e.g. `https://yourapp.com/openpay/callback`.
4. Env:

```bash
OPENPAY_CLIENT_ID="your-client-uuid"
OPENPAY_PARTNER_API_KEY="opk_live_..."
OPENPAY_PARTNER_API_BASE="https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api"
OPENPAY_REDIRECT_URI="https://yourapp.com/openpay/callback"
```

---

## 2. Connect with OpenPay (auth)

### Authorize URL

```
https://openpy.space/connect
  ?client_id={CLIENT_ID}
  &redirect_uri={EXACT_REDIRECT}
  &scope=profile%20balance
  &state={CSRF}
```

### Exchange code (backend)

```http
POST {PARTNER_API}/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "opc_...",
  "redirect_uri": "https://yourapp.com/openpay/callback",
  "client_id": "{CLIENT_ID}",
  "client_secret": "opk_live_..."
}
```

Response: `{ "access_token": "opa_live_...", "token_type": "Bearer", "expires_in": 2592000, "scope", "user_id" }`

- Codes: **10 minutes**, single-use  
- Access tokens: **30 days**

### User APIs

```http
GET {PARTNER_API}/user/me
Authorization: Bearer opa_live_...

GET {PARTNER_API}/user/balance
Authorization: Bearer opa_live_...
```

---

## 3. Payments (charges / PayButton)

```http
POST {PARTNER_API}/charges
Authorization: Bearer opk_live_...
Content-Type: application/json

{
  "amount": 19.99,
  "currency": "OUSD",
  "description": "Order #1234",
  "reference": "order_1234",
  "success_url": "https://yourapp.com/thanks",
  "cancel_url": "https://yourapp.com/cart"
}
```

Returns `{ id, amount, currency, status, checkout_url, expires_at }`.

Statuses: `created` | `paid` | `canceled` | `expired`.

```http
GET  {PARTNER_API}/charges/{id}
POST {PARTNER_API}/charges/{id}/cancel
GET  {PARTNER_API}/charges?status=paid
```

Fulfill **only** after `status === "paid"`.

---

## 4. Transfers (payout / send)

```http
POST {PARTNER_API}/transfers
Authorization: Bearer opk_live_...
Content-Type: application/json
Idempotency-Key: {uuid}

{
  "to": "OP...",
  "amount": 10.00,
  "note": "Payout"
}
```

Also: `GET /me`, `GET /balance`, `GET /accounts/:identifier`.

---

## 5. OpenPay → OpenPay Pro inbound (top-up Pro wallets)

Note format:

```
pro_xfer:@alice:r_abc123
pro_xfer:0xWALLET:r_abc123
pro_xfer:uid_<supabase-uuid>:r_abc123
```

```http
POST https://openpaypro.space/api/public/openpay/inbound
Authorization: Bearer opk_live_...
Content-Type: application/json

{
  "to": "@alice",
  "amount": 25.00,
  "openpay_tx_id": "UNIQUE_OPENPAY_TX_ID",
  "note": "pro_xfer:@alice:r_abc123",
  "from_username": "bob"
}
```

Idempotent on `openpay_tx_id`. Accepts `opk_live_…`, Pro `opdk_…`, or ledger keys (scoped).

---

## 6. Public Ledger (reconcile)

```http
GET https://openpaypro.space/api/public/ledger/entries?limit=100&asset=OUSD&type=buy
x-api-key: {LEDGER_KEY}
```

Types: `send` | `receive` | `buy` | `sell` | `swap` | `mint` | `reward`.

Also: `GET /entries/{id}`, `GET /stats`.

---

## 7. Top-up & deposit rails (OpenPay Pro product)

Partners usually deep-link users into Pro rather than re-implementing every rail:

| Method key | User-facing |
| --- | --- |
| `openpay_balance` | OpenPay Balance (Partner charges / Connect) |
| `pi` | Pi Network → OUSD |
| `moonpay` | Card / Apple Pay / Google Pay |
| `helio` / `usdc` | MoonPay Commerce crypto / USDC |
| `solana_pay` | Solana Pay QR |
| `circle_mint` | Circle Mint USDC |
| `banxa_*` | Banxa Apple/Google/card/bank |
| `cash_pay` | Phantom CASH → OUSD |
| `scan_pay` | Multi-chain QR |
| `wallet_usdt` / `wallet_usdc` / `wallet_sol` | Internal majors → OUSD |

Deep links: `https://openpaypro.space/topup` · `/deposit` · `/receive` · `/pay/{to}` · `/swap`.

---

## 8. MCP (AI agents — read-only)

```
https://openpaypro.space/mcp
```

Tools: `get_profile`, `list_wallets`, `list_transactions`, `list_ledger_entries`.  
**Does not move money** — use Partner Transfer for payouts/charges.

---

## 9. Minimal Node SDK pattern

```js
const API =
  process.env.OPENPAY_PARTNER_API_BASE ||
  "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api";
const KEY = process.env.OPENPAY_PARTNER_API_KEY; // opk_live_…
const CLIENT_ID = process.env.OPENPAY_CLIENT_ID;
const REDIRECT = process.env.OPENPAY_REDIRECT_URI;

export function connectUrl(state) {
  const u = new URL("https://openpy.space/connect");
  u.searchParams.set("client_id", CLIENT_ID);
  u.searchParams.set("redirect_uri", REDIRECT);
  u.searchParams.set("scope", "profile balance");
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeCode(code) {
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
      client_id: CLIENT_ID,
      client_secret: KEY,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createCharge(body) {
  const res = await fetch(`${API}/charges`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ currency: "OUSD", ...body }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getCharge(id) {
  const res = await fetch(`${API}/charges/${id}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function transfer({ to, amount, note, idempotencyKey }) {
  const res = await fetch(`${API}/transfers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ to, amount, note }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function creditProInbound(body) {
  const res = await fetch("https://openpaypro.space/api/public/openpay/inbound", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

---

## 10. Copy-paste prompts for AI tools

### OpenAI · ChatGPT

```
You are integrating OpenPay + OpenPay Pro as a third-party partner.

Read these first (fetch the URLs):
1) https://openpaypro.space/api/public/docs/ai-partner
2) https://openpaypro.space/api/public/docs/openapi
3) https://openpaypro.space/llms.txt

Then generate production-ready code for:
- Connect OAuth (authorize → callback → POST /oauth/token → store opa_live_)
- PayButton charges (POST /charges → redirect checkout_url → poll until paid)
- Optional payouts (POST /transfers + Idempotency-Key)
- Optional Pro inbound credit (POST /api/public/openpay/inbound)

Rules: server-only opk_live_ keys, currency OUSD, poll charges (no webhooks),
exact-match OAuth redirect_uri.

MCP (read-only wallet tools in ChatGPT): https://openpaypro.space/mcp
```

### Cursor / Claude Code / Copilot

```
Fetch https://openpaypro.space/api/public/docs/ai-partner and
https://openpaypro.space/api/public/docs/openapi
Then implement OpenPay Partner integration in this repo:
- Server-only opk_live_ key from env
- Connect OAuth (authorize → callback → /oauth/token → store opa_live_)
- PayButton charges + poll until paid
- Optional POST /transfers with Idempotency-Key
Do not invent webhooks for charges. Do not expose the partner key to the client.
```

### Lovable

```
@https://openpaypro.space/llms-full.txt
Build a merchant checkout that:
1) Creates an OpenPay charge from a server function using OPENPAY_PARTNER_API_KEY
2) Redirects the buyer to checkout_url
3) On return, polls GET /charges/:id until paid|canceled|expired
Also add a "Connect with OpenPay" button using openpy.space/connect.
```

### Replit / Claude Projects

```
Use OpenPay Partner Transfer API base
https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api
Implement auth (Connect), payments (charges), and payouts (transfers)
per https://openpaypro.space/api/public/docs/ai-partner
Secrets: OPENPAY_CLIENT_ID, OPENPAY_PARTNER_API_KEY, OPENPAY_REDIRECT_URI
```

---

## 11. Errors

| Status | Meaning | Action |
| --- | --- | --- |
| 401 | Bad / revoked key or token | Rotate; check env quotes |
| 403 | Origin / redirect not allowlisted | Exact URI match |
| 404 | Account / charge missing | Resolve `OP…` first |
| 400 | Validation / insufficient balance | Fund partner wallet; fix body |
| 5xx | Upstream | Backoff; reuse Idempotency-Key |

`invalid_client` on `/oauth/token` → wrong `client_id` / `opk_live_` or stray quotes in env.

---

## 12. Partner checklist

- [ ] App registered; `client_id` + `opk_live_…` in server secrets  
- [ ] Redirect URIs exact-matched  
- [ ] Connect → token exchange → `/user/me` works  
- [ ] Charges create + poll `paid` before fulfill  
- [ ] Transfers use `Idempotency-Key`  
- [ ] Inbound (if used) unique `openpay_tx_id` + `pro_xfer:` note  
- [ ] Ledger key for reconcile (exchanges)  
- [ ] No partner key in client bundles  

---

## Related raw feeds

- `/api/public/docs/openpay` — Connect + payments  
- `/api/public/docs/openpay-auth` — Pro auth methods  
- `/api/public/docs/partner-transfer` — Transfer API  
- `/api/public/docs/openpay-to-pro` — Inbound  
- `/api/public/docs/ledger` — Ledger  
- `/api/public/docs/exchange` — OUSD listing  
- `/api/public/docs/tokens` — Assets  
- `/api/public/docs/mcp` — MCP  
- `/api/public/docs/errors` — Errors  
- `/api/public/docs/portal` — Portal playbook  
- `/api/public/docs/openapi` — OpenAPI YAML  
