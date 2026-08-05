---
name: openpay-partner-api
description: >-
  OpenPay + OpenPay Pro partner integration — Connect OAuth, PayButton charges,
  transfers/payouts, Pro inbound (pro_xfer), top-up deep links, Public Ledger,
  MCP. Use whenever the user asks to integrate OpenPay, OpenPay Pro, partner
  API, opk_live, opa_live, PayButton, OUSD payments, inbound credit, or wants
  Cursor/Lovable/Replit/Claude-ready partner docs.
---

# OpenPay Partner API Skill

## When to use

Implement or explain third-party integrations for **OpenPay** (`openpy.space`) and **OpenPay Pro** (`openpaypro.space`): auth, payments, payouts, top-up/inbound, ledger, MCP.

## Always fetch first (preferred over memory)

1. https://openpaypro.space/api/public/docs/ai-partner  
2. https://openpaypro.space/api/public/docs/openapi  
3. https://openpaypro.space/llms.txt  

Repo mirrors: `docs/AI_PARTNER_INTEGRATION.md`, `docs/openapi-partner.yaml`, `public/llms.txt`.

## Non-negotiables

- Base Partner API: `https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api`
- Auth header: `Authorization: Bearer opk_live_…` (server only)
- User Connect token: `opa_live_…` → only `/user/me`, `/user/balance`
- Currency: **OUSD**
- **No charge webhooks** — poll `GET /charges/:id` until `paid|canceled|expired` (~2h TTL)
- Idempotency on every `POST /transfers` and Pro inbound (`openpay_tx_id`)
- Exact-match OAuth `redirect_uri`
- OUSD is **not** a public EVM/SPL contract — ledger/network asset

## Feature → endpoint cheat sheet

| Need | Do this |
| --- | --- |
| Connect login | `https://openpy.space/connect?client_id&redirect_uri&scope=profile%20balance&state` → `POST /oauth/token` |
| Checkout | `POST /charges` → redirect `checkout_url` → poll |
| Payout | `GET /accounts/:id` → `POST /transfers` + `Idempotency-Key` |
| Credit Pro wallet | note `pro_xfer:@user:ref` → `POST https://openpaypro.space/api/public/openpay/inbound` |
| Reconcile | Ledger `GET /api/public/ledger/entries` |
| Agent read-only | MCP `https://openpaypro.space/mcp` (no money move) |
| Top-up UX | Deep-link `https://openpaypro.space/topup` |

## Keys portal

https://openpy.space/partner-api — create app, copy `client_id` + `opk_live_…`.

## Implementation order for agents

1. Env: `OPENPAY_CLIENT_ID`, `OPENPAY_PARTNER_API_KEY`, `OPENPAY_REDIRECT_URI` (server)
2. Connect button + callback + token exchange
3. Create charge + success/cancel pages + poller
4. Optional transfers with UUID idempotency keys
5. Optional inbound for Pro credits
6. Never ship partner key to client / Lovable `VITE_` vars

## Related repo docs

- `docs/OPENPAY_INTEGRATION.md` — Connect + payments
- `docs/PARTNER_TRANSFER_API.md` — HTTP reference
- `docs/OPENPAY_TO_PRO.md` — inbound
- `docs/OPENPAY_PRO_AUTH.md` — Pro sign-in methods
- `docs/LEDGER_API.md` — ledger
- `docs/MCP_AGENT_CONNECT.md` — MCP
