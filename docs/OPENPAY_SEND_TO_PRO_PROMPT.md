# Prompt: Add “Send to OpenPay Pro” on OpenPay

Paste this into the **OpenPay** (`openpy.space`) agent.

---

## Goal

Let OpenPay users **send OUSD to OpenPay Pro** using either:

- Pro **`@username`**, or  
- Pro **wallet address** `0x…` (40 hex chars)

Same idea as OpenPay Pro sending out via OpenPay Pay / partner transfers.

## Note format (required)

```
pro_xfer:@PRO_USERNAME:REF
pro_xfer:0xWALLET_ADDRESS:REF
pro_xfer:uid_<uuid>:REF
```

Examples:

- `pro_xfer:@alice:r_k7x2m1`
- `pro_xfer:0x7bf2abcd…851a:r_k7x2m1`  ← **wallet address**
- `pro_xfer:uid_4aaba6a3-…:r_k7x2m1`

Funds route to the partner tag (e.g. `@wainfoundation`) with that note; Pro credits the matching Pro wallet.

## UX on OpenPay Send

1. Add destination type / tab: **OpenPay Pro**.
2. Fields:
   - **To** — Pro `@username` **or** `0x` wallet address (required)
   - Amount (OUSD)
   - Optional memo
3. Detect input:
   - starts with `0x` + 40 hex → treat as Pro wallet address  
   - otherwise → Pro `@username` (strip `@`)
4. Preview: “Send to OpenPay Pro @alice” or “Send to OpenPay Pro 0x7bf2…851a”
5. On confirm:
   - Check sender OpenPay balance
   - Debit sender (`send-money` / `transfer_funds_authenticated`)
   - Credit partner app owner (same as `/pay/wainfoundation`) with the `pro_xfer:` note
   - Call Pro inbound API so Pro credits the destination immediately
   - Show thank-you

## Pro inbound API (after successful debit)

```bash
POST https://openpaypro.space/api/public/openpay/inbound
Authorization: Bearer opk_live_PARTNER_KEY
Content-Type: application/json
```

### By username

```json
{
  "to": "@alice",
  "amount": 25.00,
  "openpay_tx_id": "<openpay_transaction_uuid>",
  "note": "pro_xfer:@alice:r_k7x2m1",
  "from_username": "bob"
}
```

### By Pro wallet address

```json
{
  "to": "0x7bf2abcd0000000000000000000000000000851a",
  "amount": 25.00,
  "openpay_tx_id": "<openpay_transaction_uuid>",
  "note": "pro_xfer:0x7bf2abcd0000000000000000000000000000851a:r_k7x2m1",
  "from_username": "bob"
}
```

Secrets (server only): `OPENPAY_PRO_INBOUND_URL`, partner `opk_live_…`.

## Hosted pay link (optional)

```
https://openpy.space/pay/wainfoundation
  ?amount=25.00&currency=OUSD
  &note=pro_xfer:0x7bf2…851a:r_xxx
  &success_url=https://openpaypro.space/receive?openpay_in=1&amount=25.00
  &cancel_url=https://openpaypro.space/receive?openpay_cancel=1
```

`/pay` one-click already supports notes starting with `pro_xfer:` (balance check → debit → thank-you → redirect).

## Acceptance

- [ ] Send by Pro `@username` → Pro wallet credited  
- [ ] Send by Pro `0x` address → same wallet credited  
- [ ] Invalid address / unknown user → clear error  
- [ ] Duplicate `openpay_tx_id` → no double credit  
- [ ] Insufficient balance → blocked  
- [ ] Never expose partner API key in the browser  
- [ ] No force-push / history rewrite  

## Refs

- Pro live docs: https://openpaypro.space/docs/openpay  
- Inbound API info: GET https://openpaypro.space/api/public/openpay/inbound  
- Detail: `docs/OPENPAY_TO_PRO.md`
