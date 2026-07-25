# OpenPay Pro — Public Ledger API

An append-only public ledger of every transaction on OpenPay Pro. Designed for
integration with **OpenLedger** or any external accounting / analytics pipeline.

Every row in `transactions` is mirrored automatically into `ledger_entries` via
a database trigger. Entries are immutable and monotonically ordered by
`sequence`.

### Covered transaction types

| Type | Source in OpenPay Pro |
|------|------------------------|
| `send` | Wallet transfer, OpenPay send |
| `receive` | Incoming transfer credit |
| `buy` | Top-up (card/bank/OpenPay checkout), Pi Network top-up, voucher redeem, OpenPay sync credit |
| `sell` | Sell / cash-out flows |
| `swap` | Token swap |
| `mint` | NFT mint |
| `reward` | Rewards / promotions |

Admins can run **Sync all transactions** on `/ledger` (or RPC `backfill_ledger_entries`) to mirror any historical rows that predate the trigger.

---

## Base URL

```
Production : https://openpaypromainnet.lovable.app/api/public/ledger
Preview    : https://id-preview--40ad0ae1-ff1c-4197-a965-091db4920f62.lovable.app/api/public/ledger
```

## Authentication

Send your API key in **either** header on every request:

```
x-api-key: <YOUR_KEY>
# or
Authorization: Bearer <YOUR_KEY>
```

Requests without a valid key return `401 Unauthorized`.

Two kinds of keys are accepted:

1. **Master key** — the `LEDGER_MASTER_API_KEY` server secret (root access).
2. **Issued keys** — created by an admin in the `ledger_api_keys` table. Only
   the SHA-256 hash is stored; the plaintext is shown once at creation.

---

## Endpoints

### `GET /entries`

List ledger entries, newest first.

**Query params**

| Param    | Type   | Description                                          |
| -------- | ------ | ---------------------------------------------------- |
| `limit`  | int    | 1–500 (default `100`)                                |
| `cursor` | int    | `sequence` from the previous page's `next_cursor`    |
| `asset`  | string | filter by token symbol (e.g. `OUSD`, `PI`)           |
| `type`   | string | `send` \| `receive` \| `buy` (top-up) \| `sell` \| `swap` \| `mint` \| `reward` |
| `address`| string | matches either `from_address` or `to_address`        |
| `since`  | ISO ts | only entries at/after this timestamp                 |

**Response**

```json
{
  "count": 100,
  "next_cursor": "1042",
  "data": [
    {
      "id": "b1e5…",
      "sequence": 1141,
      "tx_id": "a02c…",
      "from_address": "0xabc…",
      "to_address": "0xdef…",
      "asset": "OUSD",
      "amount": "10.00000000",
      "usd_value": "10.00",
      "type": "send",
      "status": "confirmed",
      "tx_hash": null,
      "memo": "invoice #42",
      "occurred_at": "2026-07-01T05:30:12.000Z"
    }
  ]
}
```

### `GET /entries/{id_or_sequence}`

Fetch a single entry by UUID `id` or numeric `sequence`.

### `GET /stats`

```json
{
  "total_entries": 1141,
  "latest_sequence": 1141,
  "latest_at": "2026-07-01T05:30:12.000Z",
  "server_time": "2026-07-01T05:31:00.000Z"
}
```

---

## Pagination

Cursor-based on `sequence` (strictly descending). Loop until `next_cursor` is
`null`:

```bash
curl -H "x-api-key: $KEY" \
  "$BASE/entries?limit=500&cursor=$LAST_SEQ"
```

For incremental sync store the highest `sequence` you've ingested and poll:

```bash
curl -H "x-api-key: $KEY" \
  "$BASE/entries?since=$LAST_TIMESTAMP"
```

---

## Data model (`ledger_entries`)

| Column        | Type           | Notes                              |
| ------------- | -------------- | ---------------------------------- |
| `id`          | uuid           | primary key                        |
| `sequence`    | bigint         | monotonic, unique, append-only     |
| `tx_id`       | uuid           | source transaction                 |
| `from_address`| text           | sender wallet address              |
| `to_address`  | text           | recipient wallet address           |
| `asset`       | text           | token symbol                       |
| `amount`      | numeric(38,8)  |                                    |
| `usd_value`   | numeric(38,2)  |                                    |
| `type`        | text           | send / receive / buy (top-up) / sell / swap / mint / reward |
| `status`      | text           | pending / confirmed / failed       |
| `tx_hash`     | text           | on-chain hash if any               |
| `memo`        | text           |                                    |
| `occurred_at` | timestamptz    | event time                         |

Rows are **never updated or deleted** — corrections are appended as new
entries.

---

## Example — OpenLedger sync (Node)

```ts
const BASE = "https://openpaypromainnet.lovable.app/api/public/ledger";
const KEY  = process.env.OPENPAY_LEDGER_KEY!;

let cursor: string | null = null;
do {
  const url = new URL(`${BASE}/entries`);
  url.searchParams.set("limit", "500");
  if (cursor) url.searchParams.set("cursor", cursor);
  const res  = await fetch(url, { headers: { "x-api-key": KEY } });
  const body = await res.json();
  await openledger.ingest(body.data);
  cursor = body.next_cursor;
} while (cursor);
```

---

## Issuing an API key (admin, SQL)

```sql
-- Generate a key client-side, e.g. `openssl rand -hex 24` → $NEW_KEY
insert into public.ledger_api_keys (label, prefix, key_hash, scopes)
values (
  'openledger prod',
  substr('$NEW_KEY', 1, 8),
  encode(digest('$NEW_KEY', 'sha256'), 'hex'),
  array['read']
);
```

Revoke by setting `active = false`.

---

## Errors

| Status | Meaning                          |
| ------ | -------------------------------- |
| 401    | Missing / invalid API key        |
| 404    | Entry not found                  |
| 500    | Server error (see response body) |

All responses are `application/json` and CORS-enabled (`*`).
