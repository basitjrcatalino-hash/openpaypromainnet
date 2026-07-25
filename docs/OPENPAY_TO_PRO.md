# OpenPay → OpenPay Pro transfers

Send OUSD from an **OpenPay** user into an **OpenPay Pro** wallet (mirror of Pro → OpenPay send / pay).

## How it works

```
OpenPay user  →  pays partner tag @wainfoundation
              note: pro_xfer:@proUsername:ref_…
              ↓
OpenPay Pro   →  POST /api/public/openpay/inbound  (or settle on return)
              →  credits @proUsername Pro OUSD wallet
```

Money settles on the partner OpenPay account first; Pro ledger credits the destination Pro user.

---

## Note format (routing)

```
pro_xfer:@alice:r_abc123
pro_xfer:uid_<supabase-user-uuid>:r_abc123
```

| Part | Meaning |
|------|---------|
| `pro_xfer:` | Inbound to OpenPay Pro |
| `@alice` / `uid_…` | Pro profile username or user id |
| `r_…` | Unique ref for idempotency / matching |

---

## A. Share a receive link (Pro user)

In OpenPay Pro → **Receive** → **Create OpenPay receive link**.

Example URL:

```
https://openpy.space/pay/wainfoundation
  ?amount=25.00
  &currency=OUSD
  &note=pro_xfer:@alice:r_k7x2
  &success_url=https://openpaypromainnet.lovable.app/receive?openpay_in=1&amount=25.00
  &cancel_url=https://openpaypromainnet.lovable.app/receive?openpay_cancel=1
```

Payer completes Pay on OpenPay → thank-you → returns to Pro → wallet credited.

---

## B. Server API (OpenPay or your backend)

After the OpenPay payment succeeds, credit Pro:

```bash
curl -X POST "https://openpaypromainnet.lovable.app/api/public/openpay/inbound" \
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

Auth: same partner key as Connect (`opk_live_…`).

Idempotent on `openpay_tx_id`.

---

## C. Implement on OpenPay Send (product prompt)

See [`docs/OPENPAY_SEND_TO_PRO_PROMPT.md`](./OPENPAY_SEND_TO_PRO_PROMPT.md).

Add a Send destination **OpenPay Pro** that:

1. Resolves Pro user (`@username` on Pro).
2. Builds `pro_xfer:@user:ref` note.
3. Sends OUSD to partner tag (or calls inbound API after local debit).
4. Optionally notifies Pro via `/api/public/openpay/inbound`.

---

## Bidirectional summary

| Direction | Mechanism |
|-----------|-----------|
| **Pro → OpenPay** | Pro Send rail → `POST /transfers` (prefer `OP…`) |
| **OpenPay → Pro** | Pay `/pay/@partner` + `pro_xfer:` note → Pro inbound API / settle |
| **Pro top-up (self)** | Connect + `/charges` or `/pay` with `pro_topup_` note |

Live docs: [/docs/openpay](/docs/openpay)
