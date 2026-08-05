# Trust Wallet integration

OpenPay Pro uses the [Trust Wallet REST API](https://tws.trustwallet.com) ([portal docs](https://portal.trustwallet.com/dashboard/docs), [agent skills](https://github.com/trustwallet/tw-agent-skills)) for market prices, token search, listings, address validation, and Amber swap **quotes**. Ledger buys/swaps remain custodial OpenPay Pro settlement — quotes are reference / future on-chain routing.

## Where to find it in the app

| Feature | Where |
|---------|--------|
| Hub (trending / search / safety) | **More → Trust Wallet** or `/trust-wallet` · Home More grid |
| Trending list | **Discover / Tokens → Trending** tab |
| Search | Tokens search dock + Trust Wallet hub Search tab |
| Address check | **Send** (wallet rail) while typing a recipient |
| Price compare | **Swap / OpenDEX** — “Trust Wallet index” card under the rate |
| Buy / OpenDEX pricing | Server merges TW index prices automatically |

## Credentials (server-only)

```env
TW_ACCESS_ID=…
TW_HMAC_SECRET=…
```

Aliases `TWAK_ACCESS_ID` / `TWAK_HMAC_SECRET` are also accepted. Never use a `VITE_` prefix.

## Code

| Module | Role |
|--------|------|
| `src/lib/trustwallet.server.ts` | HMAC-SHA256 client + tickers / search / listings / quote / validate |
| `src/lib/trustwallet-client.ts` | Browser helpers → same-origin proxies |
| `src/lib/trustwallet-assets.ts` | Major → `c{coinId}` / `c{coinId}_t{addr}` mapping |
| `src/lib/trustwallet.functions.ts` | Auth’d `createServerFn` wrappers |
| `src/lib/trustwallet-deeplinks.ts` | Mobile deep links + CDN logos |
| `src/routes/_authenticated/trust-wallet.tsx` | Hub UI |
| `src/routes/api/public/trustwallet-*.ts` | Same-origin proxies |

## Public endpoints

- `GET /api/public/trustwallet-status`
- `POST /api/public/trustwallet-prices` — `{ currency, assets[] }`
- `GET /api/public/trustwallet-search?query=`
- `GET /api/public/trustwallet-listings?category_id=trending`
- `POST /api/public/trustwallet-quote` — Amber route body
- `GET /api/public/trustwallet-validate?address=`

Free tier: **1 request/second**.

## Wallet Core

Native signing / multi-chain key management is out of band via [wallet-core](https://github.com/trustwallet/wallet-core). This app uses Trust Wallet as a **data + safety + quote** provider, not as a keystore.
