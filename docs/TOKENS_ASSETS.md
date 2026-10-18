# Tokens & assets — OpenPay Pro

Live page: [`/docs/tokens`](https://openpaypro.space/docs/tokens)

## OUSD

Ledger dollar on OpenPay Network (`network_id: openpay`). No public EVM/SPL contract. Decimals: 8 ledger / 2 display. Explorer: `https://openpaypro.space/ledger`.

Partner deposit/withdraw: see [`EXCHANGE_INTEGRATION.md`](./EXCHANGE_INTEGRATION.md) and Partner Transfer API.

## Majors

Pro ledger codes include: `OUSD`, `BTC`, `ETH`, `SOL`, `PI`, `USDC`, `USDT`, `PYUSD`, `USDG`, `USD1`, `CASH`, `EURC`.

Deep-links: `/assets`, `/trade`, `/swap`. Ledger filter: `?asset=USDC`.

## OpenToken

Bonding-curve community coins vs OUSD. No partner mint HTTP API — deep-link `/opentoken`, `/opentoken/create`. Activity appears on the Public Ledger.

## OpenNFT

Partner mint HTTP (`nft-partner-api`) is **not public yet**. Users mint/browse in Pro after Connect OpenPay. Deep-links: `/nfts`, `/nfts/mint`.
