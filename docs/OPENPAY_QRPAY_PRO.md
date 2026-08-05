# OpenPay → OpenPay Pro QR Pay Integration

**Paste this into the OpenPay (`openpy.space`) agent / codebase.**

Add **OpenPay Pro** as a first-class **QR Pay** payment method so merchants and users can:

- Show a QR that pays via OpenPay Balance / PayButton  
- Settle earnings to an **OpenPay Pro `@username`** or **`0x` wallet address**  
- Use Partner API (copy-paste ready) with env, polling, and inbound credit  

Live Pro docs: https://openpaypro.space/docs/pro-pay  
Partner keys: https://openpy.space/partner-api  

---

## Goal (product)

On OpenPay **QR Pay / checkout**, add method:

| Field | Value |
| --- | --- |
| Method id | `openpay_pro` |
| Label | **OpenPay Pro** |
| Description | Pay with OpenPay Balance · credit OpenPay Pro wallet |
| Icon | OpenPay Pro mark (lavender / `#ab9ff2`) |

Merchant configures receive destination once:

- Pro `@username` (e.g. `@shop`) **and/or**  
- Pro wallet `0x` + 40 hex  

Buyer scans QR → pays on OpenPay → funds credit merchant’s **OpenPay Pro** wallet.

---

## Architecture

```
OpenPay QR Pay (method: openpay_pro)
        │
        ├─ A) PayButton charge QR
        │     POST /charges → encode checkout_url / paybutton URL as QR
        │     poll GET /charges/:id until paid
        │     optional: POST Pro inbound → credit @user / 0x
        │
        └─ B) Hosted pay QR (pro_xfer)
              QR → https://openpy.space/pay/{PARTNER_TAG}?amount=&note=pro_xfer:…
              on success → POST Pro inbound (idempotent)
```

**Preferred for merchants:** Path A (charges) + inbound.  
**Preferred for simple Pro receive links:** Path B (`pro_xfer` note).

---

## Bases & auth

```
Partner Transfer API:
https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api

PayButton UI:
https://openpy.space/paybutton/{CHARGE_ID}

Hosted pay:
https://openpy.space/pay/{USERNAME}

Pro inbound:
POST https://openpaypro.space/api/public/openpay/inbound

Pro pay deep-link (optional after top-up):
https://openpaypro.space/pay/{@user|0x}?amount=&asset=OUSD

Pro Top Up (full rails: Pi, Banxa, MoonPay…):
https://openpaypro.space/topup
```

Auth header (server only):

```
Authorization: Bearer opk_live_YOUR_KEY
```

Never ship `opk_live_…` to the browser.

---

## Env (OpenPay server)

```bash
# Partner Transfer (required)
OPENPAY_PARTNER_API_KEY="opk_live_..."
OPENPAY_PARTNER_API_BASE="https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api"
OPENPAY_CLIENT_ID="your-client-uuid"          # if Connect used
OPENPAY_REDIRECT_URI="https://openpy.space/..." # if Connect used

# Pro settlement
OPENPAY_PRO_INBOUND_URL="https://openpaypro.space/api/public/openpay/inbound"

# Default merchant receive (can be per-merchant in DB)
OPENPAY_PRO_DEFAULT_USERNAME="@shop"
OPENPAY_PRO_DEFAULT_WALLET=""                 # optional 0x…
OPENPAY_PRO_PARTNER_TAG="wainfoundation"      # OpenPay tag that receives /pay first
```

Per-merchant dashboard fields:

```json
{
  "qrpay_method": "openpay_pro",
  "pro_username": "@shop",
  "pro_wallet": "0x7bf2abcd0000000000000000000000000000851a",
  "amount_ousd": 25.00,
  "order_ref": "order_9001",
  "success_url": "https://openpy.space/qrpay/thanks",
  "cancel_url": "https://openpy.space/qrpay/cancel"
}
```

---

## QR payload formats (encode these as QR)

### 1) PayButton charge QR (recommended)

Server creates charge, then QR encodes the checkout URL:

```
https://openpy.space/paybutton/{CHARGE_ID}
```

or the returned `checkout_url`.

### 2) Hosted pay + Pro routing note

```
https://openpy.space/pay/{PARTNER_TAG}
  ?amount=25.00
  &currency=OUSD
  &note=pro_xfer:@shop:r_order_9001
  &success_url=https://openpy.space/qrpay/thanks?ref=order_9001
  &cancel_url=https://openpy.space/qrpay/cancel?ref=order_9001
```

By Pro wallet address:

```
&note=pro_xfer:0x7bf2abcd0000000000000000000000000000851a:r_order_9001
```

### 3) Pro native pay link QR (buyer already has Pro balance)

```
https://openpaypro.space/pay/@shop?amount=25&asset=OUSD&note=order_9001
```

or

```
https://openpaypro.space/pay/0x7bf2…851a?amount=25&asset=OUSD
```

### 4) Optional HTTPS pay URI (camera-friendly)

Same as (3). Do **not** use custom `openpay:` schemes for camera QR (phones show “No data”).

---

## Note format (required for Pro credit)

```
pro_xfer:@PRO_USERNAME:REF
pro_xfer:0xWALLET_ADDRESS:REF
pro_xfer:uid_<supabase-uuid>:REF
```

Examples:

- `pro_xfer:@alice:r_k7x2m1`
- `pro_xfer:0x7bf2abcd0000000000000000000000000000851a:r_k7x2m1`
- `pro_xfer:uid_4aaba6a3-…:r_k7x2m1`

`REF` must be unique per payment (use order id / uuid).

---

## API — create charge (Path A)

```http
POST {PARTNER_API}/charges
Authorization: Bearer opk_live_…
Content-Type: application/json

{
  "amount": 25.00,
  "currency": "OUSD",
  "description": "QR Pay order_9001",
  "reference": "order_9001",
  "success_url": "https://openpy.space/qrpay/thanks?ref=order_9001",
  "cancel_url": "https://openpy.space/qrpay/cancel?ref=order_9001"
}
```

Response:

```json
{
  "id": "CHARGE_ID",
  "amount": 25,
  "currency": "OUSD",
  "status": "created",
  "checkout_url": "https://openpy.space/…",
  "expires_at": "…"
}
```

TTL ~**2 hours**. Statuses: `created` | `paid` | `canceled` | `expired`.

### Poll (no partner webhooks)

```http
GET {PARTNER_API}/charges/{CHARGE_ID}
Authorization: Bearer opk_live_…
```

Fulfill / call inbound **only** when `status === "paid"`.

### Cancel unpaid

```http
POST {PARTNER_API}/charges/{CHARGE_ID}/cancel
Authorization: Bearer opk_live_…
```

---

## API — credit OpenPay Pro wallet (inbound)

After OpenPay debit succeeds (charge `paid` or hosted `/pay` success):

```http
POST https://openpaypro.space/api/public/openpay/inbound
Authorization: Bearer opk_live_…
Content-Type: application/json
```

### By @username

```json
{
  "to": "@shop",
  "amount": 25.00,
  "openpay_tx_id": "UNIQUE_OPENPAY_OR_CHARGE_ID",
  "note": "pro_xfer:@shop:r_order_9001",
  "from_username": "buyer"
}
```

### By Pro wallet address

```json
{
  "to": "0x7bf2abcd0000000000000000000000000000851a",
  "amount": 25.00,
  "openpay_tx_id": "UNIQUE_OPENPAY_OR_CHARGE_ID",
  "note": "pro_xfer:0x7bf2abcd0000000000000000000000000000851a:r_order_9001",
  "from_username": "buyer"
}
```

Idempotent on `openpay_tx_id`. Use charge id or OpenPay tx uuid.

---

## OpenPay QR Pay UI (implement)

### Merchant setup screen

1. Payment method: **OpenPay Pro**  
2. Fields:
   - Receive Pro `@username` (required unless wallet set)
   - Receive Pro `0x` wallet (optional alternate)
   - Default amount (OUSD) — optional for open amount QR
3. Save to merchant profile / QR template  

### Generate QR flow

```
1. Merchant taps “Create OpenPay Pro QR”
2. Server:
   a. Validate pro_username or pro_wallet
   b. Create charge (Path A) OR build hosted pay URL (Path B)
   c. Persist { charge_id | pay_url, order_ref, amount, to }
3. Show QR image of checkout_url / paybutton / hosted URL
4. Show “Waiting for payment…” and poll charge (Path A)
5. On paid:
   a. POST Pro inbound
   b. Mark order paid in OpenPay DB
   c. Show success + optional redirect
```

### Buyer flow

1. Scan QR with phone camera / OpenPay scanner  
2. Opens PayButton or `/pay/{tag}`  
3. Signs in if needed → confirms pay  
4. Returns to `success_url`  
5. OpenPay backend verifies + inbound → Pro wallet credited  

---

## Copy-paste Node (OpenPay backend)

```js
const API =
  process.env.OPENPAY_PARTNER_API_BASE ||
  "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api";
const KEY = process.env.OPENPAY_PARTNER_API_KEY; // opk_live_…
const INBOUND =
  process.env.OPENPAY_PRO_INBOUND_URL ||
  "https://openpaypro.space/api/public/openpay/inbound";
const PARTNER_TAG = process.env.OPENPAY_PRO_PARTNER_TAG || "wainfoundation";

function proXferNote(to, ref) {
  const dest = to.startsWith("0x") || to.startsWith("@") || to.startsWith("uid_")
    ? to
    : `@${to.replace(/^@/, "")}`;
  return `pro_xfer:${dest}:r_${ref}`;
}

/** Path A — charge QR */
export async function createProQrCharge({
  amount,
  reference,
  success_url,
  cancel_url,
}) {
  const res = await fetch(`${API}/charges`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: "OUSD",
      description: `QR Pay ${reference}`,
      reference,
      success_url,
      cancel_url,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const charge = await res.json();
  return {
    charge_id: charge.id,
    qr_payload: charge.checkout_url || `https://openpy.space/paybutton/${charge.id}`,
    status: charge.status,
    expires_at: charge.expires_at,
  };
}

export async function pollChargePaid(chargeId, { maxMs = 180000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await fetch(`${API}/charges/${chargeId}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const data = await res.json();
    if (data.status === "paid") return data;
    if (data.status === "canceled" || data.status === "expired") {
      throw new Error(`Charge ${data.status}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Charge poll timeout");
}

/** Path B — hosted pay URL for QR (no charge API) */
export function buildProHostedPayQr({
  amount,
  to, // @user or 0x
  reference,
  success_url,
  cancel_url,
}) {
  const u = new URL(`https://openpy.space/pay/${PARTNER_TAG}`);
  u.searchParams.set("amount", String(amount));
  u.searchParams.set("currency", "OUSD");
  u.searchParams.set("note", proXferNote(to, reference));
  if (success_url) u.searchParams.set("success_url", success_url);
  if (cancel_url) u.searchParams.set("cancel_url", cancel_url);
  return { qr_payload: u.toString(), note: proXferNote(to, reference) };
}

/** After paid — credit Pro receive wallet */
export async function creditOpenPayPro({
  to,
  amount,
  openpay_tx_id,
  reference,
  from_username,
}) {
  const res = await fetch(INBOUND, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      amount,
      openpay_tx_id,
      note: proXferNote(to, reference),
      from_username,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Full Path A: create QR → (buyer pays) → poll → credit Pro */
export async function settleProQrPay({
  chargeId,
  to,
  amount,
  reference,
  from_username,
}) {
  const paid = await pollChargePaid(chargeId);
  await creditOpenPayPro({
    to,
    amount: amount ?? paid.amount,
    openpay_tx_id: paid.id,
    reference,
    from_username,
  });
  return paid;
}
```

### cURL quick test

```bash
# 1) Create charge
curl -X POST "$OPENPAY_PARTNER_API_BASE/charges" \
  -H "Authorization: Bearer $OPENPAY_PARTNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 25,
    "currency": "OUSD",
    "description": "QR test",
    "reference": "qr_test_1",
    "success_url": "https://openpy.space/thanks",
    "cancel_url": "https://openpy.space/cancel"
  }'

# 2) Encode returned checkout_url / paybutton URL as QR — pay it

# 3) Poll
curl -H "Authorization: Bearer $OPENPAY_PARTNER_API_KEY" \
  "$OPENPAY_PARTNER_API_BASE/charges/CHARGE_ID"

# 4) Credit Pro
curl -X POST "https://openpaypro.space/api/public/openpay/inbound" \
  -H "Authorization: Bearer $OPENPAY_PARTNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "@shop",
    "amount": 25,
    "openpay_tx_id": "CHARGE_ID",
    "note": "pro_xfer:@shop:r_qr_test_1"
  }'
```

---

## Optional Connect (buyer identity)

If QR Pay should know the OpenPay user:

```
https://openpy.space/connect
  ?client_id={CLIENT_ID}
  &redirect_uri={EXACT}
  &scope=profile%20balance
  &state={CSRF}
```

```http
POST {PARTNER_API}/oauth/token
{ "grant_type":"authorization_code", "code":"opc_…", "redirect_uri", "client_id", "client_secret":"opk_live_…" }
```

→ `opa_live_…` → `GET /user/me` · `GET /user/balance`

---

## Optional: buyer needs funds first (Pro Top Up)

If buyer has no OpenPay/Pro balance, deep-link:

```
https://openpaypro.space/topup
```

Methods available on Pro (product UI — not partner embed APIs):

| key | label |
| --- | --- |
| `pi` | Pi Network (π) |
| `openpay_balance` | OpenPay Balance |
| `moonpay` | MoonPay |
| `banxa_apple_pay` / `banxa_google_pay` / `banxa_card` / `banxa_bank` | Banxa |
| `usdc` / `helio` | USDC / Crypto deposit |
| `solana_pay` | Solana Pay QR |
| `circle_mint` | Circle Deposit |
| `cash_pay` | Phantom CASH |
| `scan_pay` | Multi-chain scan to pay |
| `wallet_usdt` / `wallet_usdc` / `wallet_sol` | Pro wallet majors |

Then pay merchant:

```
https://openpaypro.space/pay/@shop?amount=25&asset=OUSD
```

---

## Dashboard / earnings

| Where | What |
| --- | --- |
| Partner `GET /balance` | OpenPay partner wallet after charges |
| Pro wallet / activity | OUSD after inbound |
| Merchant QR Pay admin | List QRs, status `pending|paid|expired`, amount, `to` |

```bash
curl -H "Authorization: Bearer $OPENPAY_PARTNER_API_KEY" \
  "$OPENPAY_PARTNER_API_BASE/balance"
```

---

## Errors

| Status | Meaning |
| --- | --- |
| 401 | Bad / revoked `opk_live_` |
| 403 | Origin / redirect not allowlisted |
| 404 | Charge / account not found |
| 400 | Validation / insufficient balance |

Rules:

1. Server-only secrets  
2. Exact OAuth redirect match  
3. Poll charges — no partner webhooks  
4. Unique `openpay_tx_id` + `pro_xfer` ref  
5. Prefer `OP…` account numbers when resolving OpenPay users  

---

## Acceptance checklist (OpenPay QR Pay)

- [ ] Method `openpay_pro` visible in QR Pay method picker  
- [ ] Merchant can set Pro `@username` and/or `0x` receive  
- [ ] Generate QR → PayButton or hosted `/pay` URL  
- [ ] Buyer pays → OpenPay marks order paid  
- [ ] Inbound credits Pro `@user` / `0x` (idempotent)  
- [ ] Duplicate inbound with same `openpay_tx_id` does not double-credit  
- [ ] Cancel / expired charge shown correctly  
- [ ] `opk_live_` never in client bundles  
- [ ] Earnings visible on partner balance and/or Pro wallet  

---

## Related Pro docs

- Merchant guide: https://openpaypro.space/docs/pro-pay  
- Raw MD: https://openpaypro.space/api/public/docs/pro-pay  
- Connect & payments: https://openpaypro.space/docs/openpay  
- Partner Transfer API: https://openpaypro.space/docs/api  
- Inbound: https://openpaypro.space/api/public/docs/openpay-to-pro  
- AI pack: https://openpaypro.space/docs/ai  
