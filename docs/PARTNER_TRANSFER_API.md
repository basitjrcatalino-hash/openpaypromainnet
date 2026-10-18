# OpenPay Partner Transfer API

Integration reference for OpenPay Pro (and other partner apps).

For the full **Connect + Payments** guide for third-party apps, see
[`OPENPAY_INTEGRATION.md`](./OPENPAY_INTEGRATION.md) or the live page
[`/docs/openpay`](https://openpaypro.space/docs/openpay).

**AI / agent pack (OpenAI · ChatGPT · Cursor · Claude):**  
[`AI_PARTNER_INTEGRATION.md`](./AI_PARTNER_INTEGRATION.md) · live [`/docs/ai`](https://openpaypro.space/docs/ai) · raw [`/api/public/docs/ai-partner`](https://openpaypro.space/api/public/docs/ai-partner) · OpenAPI [`/api/public/docs/openapi`](https://openpaypro.space/api/public/docs/openapi)

For **exchanges listing OUSD** (deposit / withdraw / network metadata), see
[`EXCHANGE_INTEGRATION.md`](./EXCHANGE_INTEGRATION.md) or
[`/docs/exchange`](https://openpaypro.space/docs/exchange).

**Partner API portal:** [https://openpy.space/partner-api](https://openpy.space/partner-api)  
**Auth docs:** [https://openpy.space/openpay-auth](https://openpy.space/openpay-auth)  
**Base URL:** `https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api`

## Authentication

Send your key in the Authorization header:

```
Authorization: Bearer opk_live_YOUR_KEY
```

---

## Account & transfers (partner key)

### `GET /me`

Returns the OpenPay account (name, username, account number, balance) that owns this key.

```bash
curl -H "Authorization: Bearer opk_live_YOUR_KEY" \
  https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/me
```

### `GET /balance`

```bash
curl -H "Authorization: Bearer opk_live_YOUR_KEY" \
  https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/balance
```

### `GET /accounts/:identifier`

Resolve any OpenPay user by `@username`, account number (`OP…`), or email.

```bash
curl -H "Authorization: Bearer opk_live_YOUR_KEY" \
  https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/accounts/@satoshi
```

### `POST /transfers` — Send balance

Debits the key owner's OpenPay balance and credits the recipient. Use `Idempotency-Key` to safely retry.

```bash
curl -X POST "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/transfers" \
  -H "Authorization: Bearer opk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"to":"@username","amount":10.00,"note":"Payout"}'
```

Body: `{ "to": "OP...|@username|email", "amount": 10.00, "note": "optional", "idempotency_key": "optional" }`

---

## PayButton — Accept OpenPay balance

Create a charge from your backend, redirect the buyer to `checkout_url`. Funds land in the partner-app owner's OpenPay wallet in real time.

### `POST /charges` — Create a checkout

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

Returns `{ id, amount, currency, status, checkout_url, expires_at }`. Charges expire in **2 hours**.

Drop-in button after creating a charge:

```html
<a href="https://openpy.space/paybutton/CHARGE_ID"
   style="display:inline-flex;align-items:center;gap:8px;background:#1652f0;color:#fff;
   padding:12px 20px;border-radius:10px;font-weight:600;text-decoration:none;">
  Pay with OpenPay
</a>
```

### `GET /charges/:id` — Check status

Status values: `created`, `paid`, `canceled`, `expired`.

```bash
curl -H "Authorization: Bearer opk_live_YOUR_KEY" \
  https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/charges/CHARGE_ID
```

List: `GET /charges?status=paid`

### `POST /charges/:id/cancel`

```bash
curl -X POST -H "Authorization: Bearer opk_live_YOUR_KEY" \
  https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/charges/CHARGE_ID/cancel
```

---

## Connect with OpenPay — OAuth 2.0

Standard Authorization Code flow. Users sign in on OpenPay and grant `profile` / `balance`.

### 1. Register redirect URIs

Exact match required. OpenPay Pro always uses production:

`https://openpaypro.space/openpay/connect/callback`

(Localhost / preview origins are rewritten to this URL — do not register localhost.)

### 2. Send the user to OpenPay

```
https://openpy.space/connect
  ?client_id=YOUR_APP_ID
  &redirect_uri=https://yourapp.com/openpay/callback
  &scope=profile%20balance
  &state=RANDOM_CSRF_TOKEN
```

### 3. Handle the callback

Success: `?code=opc_...&state=...`  
Cancel: `?error=access_denied`

### 4. Exchange the code for an access token

From your backend (never expose the API key to the browser):

```bash
curl -X POST "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "opc_...",
    "redirect_uri": "https://yourapp.com/openpay/callback",
    "client_id": "YOUR_APP_ID",
    "client_secret": "opk_live_YOUR_KEY"
  }'
```

Response: `{ access_token: "opa_live_...", token_type: "Bearer", expires_in: 2592000, scope, user_id }`.  
Codes expire in **10 minutes** (single-use). Access tokens last **30 days**.

### 5. Call OpenPay on behalf of the user

```bash
curl -H "Authorization: Bearer opa_live_..." \
  https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/user/me

curl -H "Authorization: Bearer opa_live_..." \
  https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/user/balance
```

`GET /user/me` returns `{ user_id, account_number, full_name, username, avatar_url, balance, currency, scope }`.

Drop-in Connect button:

```html
<a href="https://openpy.space/connect?client_id=YOUR_APP_ID&redirect_uri=https://yourapp.com/openpay/callback&scope=profile%20balance&state=xyz"
   style="display:inline-flex;align-items:center;gap:8px;background:#1652f0;color:#fff;
   padding:12px 20px;border-radius:10px;font-weight:600;text-decoration:none;">
  Connect with OpenPay
</a>
```

---

## Errors

| Status | Meaning |
|--------|---------|
| 401 | missing / invalid / revoked key |
| 403 | origin not whitelisted |
| 404 | recipient not found |
| 400 | validation error (amount, insufficient balance…) |

---

## OpenPay Pro wiring

| Concern | Implementation |
|---------|----------------|
| Authorize URL | `OPENPAY_OAUTH_AUTHORIZE_URL` → `https://openpy.space/connect` |
| Client ID | `OPENPAY_OAUTH_CLIENT_ID` |
| Partner key | `OPENPAY_PARTNER_API_KEY` (`opk_live_…`) |
| Callback | `/openpay/connect/callback` |
| Token exchange | `exchangeOAuthCode` → `/oauth/token` |
| Profile / sync | `/user/me`, `/user/balance` with stored `opa_live_…` |
| Top Up | `POST /charges` → redirect `checkout_url` |
| Send to OpenPay | `POST /transfers` |
