# OpenPay Network — Exchange & Partner Token Integration (OUSD)

Integrate **OUSD** (OpenUSD) into your exchange, wallet, or fintech app the same way you add a supported network asset: identify the network, authenticate with partner keys, then wire **deposit**, **withdraw**, and **balance / swap** rails over HTTP APIs.

| | |
| --- | --- |
| **Asset** | `OUSD` — OpenPay ledger dollar (~$1 USD) |
| **Network id** | `openpay` (custodial open network ledger — not a public EVM/SPL contract) |
| **Decimals** | `8` (ledger precision); display often `2` |
| **Partner portal** | [https://openpy.space/partner-api](https://openpy.space/partner-api) |
| **Partner Transfer API** | `https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api` |
| **OpenPay Pro (this app)** | `https://openpaypro.space` |
| **Pro inbound credit** | `POST https://openpaypro.space/api/public/openpay/inbound` |
| **Public Ledger API** | `https://openpaypro.space/api/public/ledger` |
| **Live HTML docs** | [/docs/exchange](/docs/exchange) · [/docs/openpay](/docs/openpay) |
| **Raw markdown** | [/api/public/docs/exchange](/api/public/docs/exchange) |

> **Important:** OUSD lives on OpenPay’s **open network ledger** (balances in OpenPay / OpenPay Pro wallets). There is no public ERC-20 / SPL mint address for partners to scrape on-chain. Treat OpenPay like a **network + API**, similar to integrating a centralized ledger chain via REST.

---

## 1. Mental model (like listing a chain)

When exchanges list BTC, ETH, or SOL they configure:

1. **Network name** + confirmations  
2. **Deposit address** format  
3. **Withdraw** destination format + fees  
4. **API / explorer** for monitoring  

For OpenPay / OUSD map the same concepts:

| Exchange concept | OpenPay / OUSD equivalent |
| --- | --- |
| Network | `openpay` open network ledger |
| Native asset | `OUSD` |
| Deposit address | OpenPay `@username`, account `OP…`, or Pro wallet `0x…` / `@proUsername` |
| Confirmations | Partner Transfer / inbound API **idempotent** receipt (`Idempotency-Key` / `openpay_tx_id`) |
| Explorer | [Public Ledger API](/docs/openpay#ledger) + in-app `/ledger` |
| Hot wallet | Your partner OpenPay account (funds the API key) |
| User balance on your exchange | Your DB — credit when OpenPay confirms a transfer **to** you; debit when you call `/transfers` **out** |

```
┌─────────────┐     Partner Transfer API      ┌──────────────────┐
│  Your       │  ───────────────────────────► │  OpenPay         │
│  Exchange   │  deposit / withdraw / pay   │  (openpy.space)  │
│  or App     │  ◄─────────────────────────── │  OUSD balances   │
└─────────────┘                               └────────┬─────────┘
                                                       │ inbound
                                                       ▼
                                              ┌──────────────────┐
                                              │  OpenPay Pro     │
                                              │  Pro wallet OUSD │
                                              └──────────────────┘
```

---

## 2. Quick start checklist

1. Register an app at [Partner API portal](https://openpy.space/partner-api) → copy `client_id` + `opk_live_…` (server-only).  
2. Fund the OpenPay account that owns the key (this is your “hot wallet”).  
3. Implement **deposit**: user pays your OpenPay tag / charge → you credit their exchange account.  
4. Implement **withdraw**: user requests OUSD out → your backend `POST /transfers` to their `@username` / `OP…` / Pro destination.  
5. Optionally credit **OpenPay Pro** wallets via inbound API for Pro users.  
6. Mirror activity with the **Ledger API** for reconciliation / OpenLedger.  
7. Never put `opk_live_…` in mobile/web clients.

---

## 3. Network & asset metadata (for your listing UI)

Suggested fields for your admin “add token / network” form:

```json
{
  "network_id": "openpay",
  "network_name": "OpenPay Network",
  "chain_type": "ledger_api",
  "explorer_url": "https://openpaypro.space/ledger",
  "docs_url": "https://openpaypro.space/docs/exchange",
  "native_symbol": "OUSD",
  "assets": [
    {
      "symbol": "OUSD",
      "name": "OpenUSD",
      "decimals": 8,
      "display_decimals": 2,
      "peg": "USD",
      "contract_address": null,
      "deposit_enabled": true,
      "withdraw_enabled": true,
      "min_deposit": 0.01,
      "min_withdraw": 0.01
    }
  ],
  "address_formats": [
    { "type": "username", "pattern": "^@[A-Za-z0-9_]{3,32}$", "example": "@satoshi" },
    { "type": "account", "pattern": "^OP[A-Z0-9]+$", "example": "OP…" },
    { "type": "pro_wallet", "pattern": "^0x[a-fA-F0-9]{40}$", "example": "0x…" }
  ],
  "api": {
    "partner_base": "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api",
    "pro_inbound": "https://openpaypro.space/api/public/openpay/inbound",
    "ledger_base": "https://openpaypro.space/api/public/ledger"
  }
}
```

---

## 4. Authentication

### Partner key (server)

```
Authorization: Bearer opk_live_YOUR_KEY
```

Used for `/me`, `/balance`, `/accounts/:id`, `/transfers`, `/charges`, and Pro inbound.

### OAuth access token (user-linked)

For “Connect with OpenPay” so your app acts with user consent (`profile`, `balance` scopes). See [OPENPAY_INTEGRATION.md](./OPENPAY_INTEGRATION.md).

Token exchange:

```
POST {partner_base}/oauth/token
```

---

## 5. Deposit (user → your exchange)

**Goal:** User sends OUSD on OpenPay Network; your exchange credits their trading account.

### Pattern A — PayButton / charge (recommended for apps)

1. Backend creates a charge:

```bash
curl -X POST "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/charges" \
  -H "Authorization: Bearer opk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.00,
    "currency": "OUSD",
    "description": "Deposit to ExchangeAccount#42",
    "reference": "dep_42_abc",
    "success_url": "https://your.exchange/deposits/openpay/success",
    "cancel_url": "https://your.exchange/deposits/openpay/cancel"
  }'
```

2. Redirect user to `checkout_url` (or `https://openpy.space/paybutton/{id}`).  
3. Poll `GET /charges/:id` until `paid`.  
4. Credit `100 OUSD` on your books (idempotent on `reference` / charge `id`).

Status values: `created` · `paid` · `canceled` · `expired` (charges expire in ~2 hours). Partner webhooks are not required — **poll**.

### Pattern B — Direct transfer to your hot wallet

Publish your OpenPay `@partner` / `OP…` as the deposit destination. User sends via OpenPay. Your ops / listener credits when you detect the incoming transfer (Partner portal activity + Ledger / your own matching on `note` / reference).

### Pattern C — Credit OpenPay Pro wallets (Pro network users)

After OpenPay payment succeeds, credit a **Pro** wallet:

```bash
curl -X POST "https://openpaypro.space/api/public/openpay/inbound" \
  -H "Authorization: Bearer opk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "@alice",
    "amount": 25.00,
    "openpay_tx_id": "UNIQUE_OPENPAY_TX_ID",
    "note": "pro_xfer:@alice:r_k7x2",
    "from_username": "bob"
  }'
```

Routing note format: `pro_xfer:@user:r_ref` or `pro_xfer:0xWallet:r_ref`. Idempotent on `openpay_tx_id`. Full guide: [OPENPAY_TO_PRO.md](./OPENPAY_TO_PRO.md).

---

## 6. Withdraw (your exchange → user OpenPay / Pro)

**Goal:** Debit the user’s exchange balance; send OUSD on OpenPay Network.

```bash
curl -X POST "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/transfers" \
  -H "Authorization: Bearer opk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: withdraw_user42_batch9" \
  -d '{
    "to": "@satoshi",
    "amount": 50.00,
    "note": "Withdraw from YourExchange #9001"
  }'
```

- `to`: `@username` · `OP…` account · email (as supported by Partner API).  
- Always send **Idempotency-Key** so retries do not double-pay.  
- Debit your hot-wallet OpenPay balance (the key owner).  
- Validate destination with `GET /accounts/:identifier` before sending.

For Pro destinations, combine transfer + inbound / `pro_xfer` notes as documented in OpenPay → Pro.

---

## 7. Balance, accounts, identity

```bash
# Your hot wallet
curl -H "Authorization: Bearer opk_live_YOUR_KEY" \
  https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/me

curl -H "Authorization: Bearer opk_live_YOUR_KEY" \
  https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/balance

# Resolve a user
curl -H "Authorization: Bearer opk_live_YOUR_KEY" \
  https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api/accounts/@satoshi
```

With a user OAuth access token you can read **their** profile/balance under Connect scopes (see integration guide).

---

## 8. Swap / convert

On OpenPay Pro, users swap ledger assets (OUSD ↔ majors / OpenTokens) in-app via OpenDEX. Those moves appear on the public ledger as `type: "swap"`.

**Partner integration options:**

1. **Off-book on your exchange** — hold OUSD in your hot wallet; offer spot pairs `OUSD/USDT` etc. on your matching engine (you manage inventory).  
2. **Deep link users to Pro swap** — `https://openpaypro.space/swap` (user completes swap in Pro wallet).  
3. **Reconcile** — subscribe/poll Ledger API filtered by `type=swap` and `asset=OUSD` for analytics (not for settling your CEX books unless you design for it).

There is no public partner endpoint that executes OpenDEX swaps on behalf of arbitrary users yet — use transfers + your own order book, or send users to Pro.

---

## 9. Public Ledger API (explorer / audit)

```
Base: https://openpaypro.space/api/public/ledger
Auth: x-api-key: <KEY>   or   Authorization: Bearer <KEY>
```

| Method | Path | Use |
| --- | --- | --- |
| `GET` | `/entries` | List entries (`asset=OUSD`, `type=…`, cursor) |
| `GET` | `/entries/:id` | Single entry |
| `GET` | `/stats` | Aggregate stats |

Covered types: `send`, `receive`, `buy`, `sell`, `swap`, `mint`, `reward`.  
Details: [LEDGER_API.md](./LEDGER_API.md) · [/docs/openpay#ledger](/docs/openpay#ledger).

---

## 10. Errors & safety

| Practice | Why |
| --- | --- |
| Idempotency keys on transfers / inbound | Prevent double deposits & withdrawals |
| Poll charges until terminal state | No partner webhooks yet |
| Server-only API keys | Key = hot wallet |
| Validate `to` via `/accounts` | Avoid fat-finger sends |
| Min amounts ≥ `0.01` OUSD | Matches OpenPay precision floors |
| Reconcile with Ledger | Catch ops drift |

---

## 11. Launch checklist for exchanges

- [ ] Partner app registered; key stored in KMS / secrets  
- [ ] Hot wallet funded with OUSD  
- [ ] Deposit: charge or transfer flow + idempotent credit  
- [ ] Withdraw: `/transfers` + destination validation  
- [ ] Listing metadata (`openpay` / `OUSD`) published in your UI  
- [ ] Support runbook: Partner portal + Ledger + `/docs/exchange`  
- [ ] Optional: Pro inbound for OpenPay Pro users  
- [ ] Optional: Ledger API key for monitoring  

---

## 12. Related docs

| Doc | URL |
| --- | --- |
| Connect + payments | [OPENPAY_INTEGRATION.md](./OPENPAY_INTEGRATION.md) · [/docs/openpay](/docs/openpay) |
| Partner Transfer reference | [PARTNER_TRANSFER_API.md](./PARTNER_TRANSFER_API.md) |
| OpenPay → Pro | [OPENPAY_TO_PRO.md](./OPENPAY_TO_PRO.md) |
| Pro auth methods | [OPENPAY_PRO_AUTH.md](./OPENPAY_PRO_AUTH.md) |
| Ledger API | [LEDGER_API.md](./LEDGER_API.md) |
| OUSD product page | [/openusd](/openusd) |

---

## Support

- Partner portal: [https://openpy.space/partner-api](https://openpy.space/partner-api)  
- Auth docs: [https://openpy.space/openpay-auth](https://openpy.space/openpay-auth)  
- Pro docs hub: [https://openpaypro.space/docs/openpay](https://openpaypro.space/docs/openpay)
