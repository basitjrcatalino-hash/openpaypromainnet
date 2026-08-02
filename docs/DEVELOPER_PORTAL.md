# OpenPay Pro — Developer Portal Playbook

Complete integration map for **exchanges**, **merchants**, **wallet apps**, and **AI agents**.

Live portal: [https://openpaypro.space/docs](https://openpaypro.space/docs)

| Surface | URL |
| --- | --- |
| Developer Portal | https://openpaypro.space/docs |
| Connect & payments | https://openpaypro.space/docs/openpay |
| Exchange · OUSD | https://openpaypro.space/docs/exchange |
| Money rails | https://openpaypro.space/docs/money |
| Tokens | https://openpaypro.space/docs/tokens |
| Partner Transfer API | https://openpaypro.space/docs/api |
| Public Ledger API | https://openpaypro.space/docs/ledger |
| Agent Connect · MCP | https://openpaypro.space/docs/mcp |
| FAQ | https://openpaypro.space/docs/faq |
| Errors & retries | https://openpaypro.space/docs/errors |
| Authentication | https://openpaypro.space/docs/auth |
| Partner portal (keys) | https://openpy.space/partner-api |
| Partner Transfer base | `https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api` |
| Pro inbound | `POST https://openpaypro.space/api/public/openpay/inbound` |
| Ledger HTTP | `https://openpaypro.space/api/public/ledger` |
| MCP | `https://openpaypro.space/mcp` |

---

## Feature → integration path

| Feature | How partners integrate |
| --- | --- |
| **Payments (checkout)** | `POST /charges` → PayButton `checkout_url` → poll `GET /charges/:id` |
| **Send / payout** | `POST /transfers` with `Idempotency-Key` |
| **Receive** | Resolve accounts `GET /accounts/:id` · Pro QR / `/pay` deep links · inbound `pro_xfer` |
| **Deposit** | Charges or Partner Transfer into your hot wallet · Pro top-up deep link `/topup` |
| **Withdraw** | Debit your DB → `POST /transfers` to user `@username` / `OP…` |
| **Swap** | Deep-link `/swap` or `/trade` · reconcile Ledger `type=swap` (no partner OpenDEX HTTP) |
| **OUSD listing** | See Exchange docs — network id `openpay`, ledger API asset |
| **Majors / OpenToken** | Deep-link Pro `/assets`, `/opentoken` · Ledger asset filters |
| **Connect identity** | OAuth Connect → `opa_live_` user token → `/user/me` |
| **Reconcile** | Public Ledger API + charge polling |
| **Agents** | MCP URL + tools (`get_profile`, `list_wallets`, `list_transactions`, `list_ledger_entries`) |

---

## Security non-negotiables

1. Keep `opk_live_…` on the server only.  
2. Exact-match OAuth redirect URIs.  
3. Idempotency keys on every payout / inbound credit.  
4. No partner payment webhooks yet — **poll**.  
5. OUSD is **not** a public EVM/SPL contract — integrate as ledger/network API.

---

## Raw markdown feeds

- `/api/public/docs/openpay`
- `/api/public/docs/openpay-auth`
- `/api/public/docs/exchange`
- `/api/public/docs/partner-transfer`
- `/api/public/docs/ledger`
- `/api/public/docs/openpay-to-pro`
- `/api/public/docs/tokens`
- `/api/public/docs/mcp`
- `/api/public/docs/errors`
- `/api/public/docs/portal` (this file)
