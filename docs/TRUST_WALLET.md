# Trust Wallet integration

OpenPay Pro uses the [Trust Wallet REST API](https://tws.trustwallet.com) ([portal docs](https://portal.trustwallet.com/dashboard/docs), [agent skills](https://github.com/trustwallet/tw-agent-skills)) for market prices, token search, listings, address validation, and Amber swap **quotes**. Ledger buys/swaps remain custodial OpenPay Pro settlement — quotes are reference / future on-chain routing.

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
| `src/lib/trustwallet-assets.ts` | Major → `c{coinId}` / `c{coinId}_t{addr}` mapping |
| `src/lib/trustwallet.functions.ts` | Auth’d `createServerFn` wrappers |
| `src/lib/trustwallet-deeplinks.ts` | Mobile deep links + CDN logos |
| `src/routes/api/public/trustwallet-*.ts` | Same-origin proxies (secrets stay on server) |

## Public endpoints

- `GET /api/public/trustwallet-status`
- `POST /api/public/trustwallet-prices` — `{ currency, assets[] }`
- `GET /api/public/trustwallet-search?query=`
- `GET /api/public/trustwallet-listings?category_id=trending`
- `POST /api/public/trustwallet-quote` — Amber route body
- `GET /api/public/trustwallet-validate?address=`

## Pricing

Buy / OpenDEX servers merge Trust Wallet index prices over CoinGecko via `mergeTrustWalletMajorPrices`. The browser enriches `fetchMajorUsdPrices` through `/api/public/trustwallet-prices`.

Free tier: **1 request/second**.

## Wallet Core

Native signing / multi-chain key management is out of band via [wallet-core](https://github.com/trustwallet/wallet-core). This app currently uses Trust Wallet as a **data + quote** provider, not as a keystore.
