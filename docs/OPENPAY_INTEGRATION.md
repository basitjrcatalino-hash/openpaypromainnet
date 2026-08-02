# OpenPay — Connect Auth & Payments for Third-Party Apps

Use this guide to add **Connect with OpenPay** (OAuth 2.0) and **OpenPay Balance payments** to your product — the same integration used by [OpenPay Pro](https://openpaypro.space).

|                                   |                                                                                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OpenPay app**                   | [https://openpy.space](https://openpy.space)                                                                                                             |
| **Partner API portal**            | [https://openpy.space/partner-api](https://openpy.space/partner-api)                                                                                     |
| **Auth docs**                     | [https://openpy.space/openpay-auth](https://openpy.space/openpay-auth)                                                                                   |
| **Partner API**                   | `https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api`                                                                             |
| **Live docs (this site)**         | [/docs/openpay](/docs/openpay)                                                                                                                           |
| **Exchange / OUSD network**       | [/docs/exchange](/docs/exchange) · [EXCHANGE_INTEGRATION.md](./EXCHANGE_INTEGRATION.md) · [/api/public/docs/exchange](/api/public/docs/exchange)         |
| **Pro auth methods (full setup)** | [/docs/openpay#auth](/docs/openpay#auth) · [OPENPAY_PRO_AUTH.md](./OPENPAY_PRO_AUTH.md) · [/api/public/docs/openpay-auth](/api/public/docs/openpay-auth) |

---

## OpenPay Pro wallet sign-in methods

OpenPay Pro (`/authpi`) supports **seven** authentication methods (OpenPay, Telegram, Solana, Pi, Phantom, WalletConnect, MetaMask). Full exact setup (env, flows, files, security):

→ **[OpenPay Pro Authentication Integration Guide](./OPENPAY_PRO_AUTH.md)**  
→ Live page: [`/docs/openpay#auth`](/docs/openpay#auth)  
→ Raw Markdown: [`/api/public/docs/openpay-auth`](/api/public/docs/openpay-auth)

| Method        | Integration                                     |
| ------------- | ----------------------------------------------- |
| OpenPay       | OAuth 2.0 Connect                               |
| Solana        | Sign In With Solana (Phantom / Wallet Standard) |
| Pi Network    | Pi Browser SDK or Pi OAuth                      |
| Phantom       | Phantom Connect (extension · Google · Apple)    |
| WalletConnect | EVM SIWE login                                  |
| MetaMask      | Embedded Wallets social OAuth (Web3Auth)        |

---

## 1. Create a partner app

1. Open the [Partner API portal](https://openpy.space/partner-api) → **Apps & keys** → Register app.
2. Copy the `opk_live_…` API key immediately (shown once). Save the **client_id** (UUID).
3. Enter only your domain (e.g. `www.yourapp.com`) and click **Auto-fill & save**, or register **exact** redirect URIs (no trailing slash), e.g.:
   - `https://yourapp.com/openpay/callback`
   - `https://yourapp.com/openpay/connect/callback`
   - Auto-fill also registers `/auth/openpay/callback` and `/openpay/connect/callback`

Never expose `opk_live_…` in the browser. Use it only on your backend.

---

## 2. Connect with OpenPay (OAuth 2.0)

Standard **Authorization Code** flow. Scopes: `profile`, `balance`.

### 2.1 Send the user to OpenPay

```
https://openpy.space/connect
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/openpay/callback
  &scope=profile%20balance
  &state=RANDOM_CSRF_TOKEN
```

Drop-in button:

```html
<a
  href="https://openpy.space/connect?client_id=YOUR_CLIENT_ID&redirect_uri=https://yourapp.com/openpay/callback&scope=profile%20balance&state=xyz"
  style="display:inline-flex;align-items:center;gap:8px;background:#1652f0;color:#fff;
   padding:12px 20px;border-radius:10px;font-weight:600;text-decoration:none;"
>
  Connect with OpenPay
</a>
```

### 2.2 Handle the callback

Success:

```
https://yourapp.com/openpay/callback?code=opc_...&state=...
```

Cancel:

```
https://yourapp.com/openpay/callback?error=access_denied
```

Verify `state` matches what you stored.

### 2.3 Exchange the code (backend only)

```bash
curl -X POST "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "opc_...",
    "redirect_uri": "https://yourapp.com/openpay/callback",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "opk_live_YOUR_KEY"
  }'
```

Response:

```json
{
  "access_token": "opa_live_...",
  "token_type": "Bearer",
  "expires_in": 2592000,
  "scope": "profile balance",
  "user_id": "..."
}
```

- Codes expire in **10 minutes** (single-use).
- Access tokens last **30 days**.

### 2.4 Call OpenPay on behalf of the user

```bash
curl -H "Authorization: Bearer opa_live_..." \
  https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/user/me

curl -H "Authorization: Bearer opa_live_..." \
  https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/user/balance
```

`GET /user/me` returns:

```json
{
  "user_id": "...",
  "account_number": "OP...",
  "full_name": "...",
  "username": "...",
  "avatar_url": "...",
  "balance": 12.34,
  "currency": "OUSD",
  "scope": "profile balance"
}
```

### Connect sequence

```
Your app  →  openpy.space/connect  →  user signs in + Allow
         ←  ?code=opc_…&state=…
Your backend  →  POST /oauth/token  →  opa_live_…
Your backend  →  GET /user/me | /user/balance
```

---

## 3. Accept payment (OpenPay balance)

Two patterns. Prefer **PayButton `/charges`** when available; use **`/pay/@username`** as a hosted pay link.

### 3.A PayButton — `POST /charges` (recommended)

Debits the **buyer’s** OpenPay balance; credits **your partner-app owner** wallet.

```bash
curl -X POST "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/charges" \
  -H "Authorization: Bearer opk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 19.99,
    "currency": "OUSD",
    "description": "Order #1234",
    "reference": "order_1234",
    "success_url": "https://yourapp.com/thanks",
    "cancel_url": "https://yourapp.com/cart"
  }'
```

Returns `{ id, amount, currency, status, checkout_url, expires_at }` (expires in **2 hours**).

Redirect the buyer to `checkout_url`, or:

```html
<a href="https://openpy.space/paybutton/CHARGE_ID">Pay with OpenPay</a>
```

Poll status:

```bash
curl -H "Authorization: Bearer opk_live_YOUR_KEY" \
  https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/charges/CHARGE_ID
```

Status: `created` | `paid` | `canceled` | `expired`.

Cancel unpaid:

```bash
curl -X POST -H "Authorization: Bearer opk_live_YOUR_KEY" \
  https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/charges/CHARGE_ID/cancel
```

### 3.B Hosted pay tag — `/pay/@username`

When you want the buyer to pay your OpenPay tag (username) from their balance:

```
https://openpy.space/pay/YOUR_USERNAME
  ?amount=25.00
  &currency=OUSD
  &note=order_1234
  &success_url=https://yourapp.com/thanks
  &cancel_url=https://yourapp.com/cart
```

**Expected OpenPay behavior (partner top-ups / integrations):**

1. Buyer opens the link → sees amount + note.
2. **Pay** → OpenPay checks balance → debits OUSD → thank-you page.
3. Redirect to `success_url?openpay_return=1&openpay_ref={note}&openpay_tx={id}`.
4. **Cancel** → `cancel_url?openpay_cancel=1`.

On your backend after `openpay_return=1`: verify the payment (charge status and/or matching transfer/note), then fulfill the order. On `openpay_cancel=1`, mark the order canceled.

---

## 4. Partner key endpoints (server-to-server)

Auth header for all of these:

```
Authorization: Bearer opk_live_YOUR_KEY
```

| Method | Path                  | Purpose                          |
| ------ | --------------------- | -------------------------------- |
| GET    | `/me`                 | Partner owner profile + balance  |
| GET    | `/balance`            | Partner treasury balance         |
| GET    | `/accounts/:id`       | Resolve `@user`, `OP…`, or email |
| POST   | `/transfers`          | Push OUSD from partner → user    |
| GET    | `/transfers`          | List partner transfers           |
| POST   | `/charges`            | Create PayButton checkout        |
| GET    | `/charges/:id`        | Charge status                    |
| POST   | `/charges/:id/cancel` | Cancel unpaid charge             |
| POST   | `/oauth/token`        | Exchange Connect code            |
| GET    | `/user/me`            | End-user profile (`opa_live_…`)  |
| GET    | `/user/balance`       | End-user balance (`opa_live_…`)  |

### Push payout example

```bash
curl -X POST "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/transfers" \
  -H "Authorization: Bearer opk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"to":"OP...","amount":10.00,"note":"Payout"}'
```

Prefer **OP account numbers** for `to` / `/accounts` when possible (`@username` lookup can hit SQL ambiguity on some API versions).

---

## 5. Minimal Node example

```js
const API = "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api";
const CLIENT_ID = process.env.OPENPAY_CLIENT_ID;
const CLIENT_SECRET = process.env.OPENPAY_PARTNER_API_KEY; // opk_live_…
const REDIRECT = "https://yourapp.com/openpay/callback";

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
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { access_token, ... }
}

export async function createCharge({ amount, reference, success_url, cancel_url }) {
  const res = await fetch(`${API}/charges`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLIENT_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: "OUSD",
      description: reference,
      reference,
      success_url,
      cancel_url,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { id, checkout_url, ... }
}
```

---

## 6. Errors

| Status | Meaning                                                                       |
| ------ | ----------------------------------------------------------------------------- |
| 401    | Missing / invalid / revoked key or token (`invalid_client` on token exchange) |
| 403    | Origin not whitelisted                                                        |
| 404    | Recipient / charge not found                                                  |
| 400    | Validation (amount, insufficient balance, ambiguous SQL, etc.)                |

**`invalid_client` on `/oauth/token`:** `client_id` or `client_secret` (`opk_live_…`) wrong, or secret has extra quotes in env.

**`redirect_uri not registered`:** URI must match the partner app allowlist **exactly**.

---

## 7. Checklist for a new app

- [ ] Partner app created; `client_id` + `opk_live_…` saved in server secrets
- [ ] Redirect URIs registered (production + local if needed)
- [ ] Connect button → `/connect` → callback → `/oauth/token` → store `opa_live_…` server-side
- [ ] Payments via `/charges` **or** `/pay/@yourtag` with `success_url` / `cancel_url`
- [ ] Fulfill only after verified `paid` / confirmed return; handle cancel
- [ ] Never ship the partner API key to the frontend

---

## Related

- Partner API portal: [https://openpy.space/partner-api](https://openpy.space/partner-api)
- Auth tutorial: [https://openpy.space/openpay-auth](https://openpy.space/openpay-auth)
- OpenPay → OpenPay Pro transfers: [`OPENPAY_TO_PRO.md`](./OPENPAY_TO_PRO.md)
- OpenPay Send feature prompt: [`OPENPAY_SEND_TO_PRO_PROMPT.md`](./OPENPAY_SEND_TO_PRO_PROMPT.md)
- Partner Transfer API detail: [`PARTNER_TRANSFER_API.md`](./PARTNER_TRANSFER_API.md)
- OpenPay Pro public ledger: [`LEDGER_API.md`](./LEDGER_API.md)
- OpenPay Pro: [https://openpaypro.space](https://openpaypro.space)

---

## 8. OpenPay → OpenPay Pro (inbound)

To send from OpenPay into a Pro user’s wallet:

1. Pay link / Send with note `pro_xfer:@proUsername:ref_…` to the partner tag.
2. Credit Pro via:

```bash
curl -X POST "https://openpaypro.space/api/public/openpay/inbound" \
  -H "Authorization: Bearer opk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to":"@alice","amount":25,"openpay_tx_id":"TX_ID","note":"pro_xfer:@alice:r_1"}'
```

Pro users can also **Receive → Create OpenPay receive link** in the Pro app.

Full detail: [`OPENPAY_TO_PRO.md`](./OPENPAY_TO_PRO.md).
