# Prompt: Add “Send to OpenPay Pro” on OpenPay

Paste this into the **OpenPay** (`openpy.space`) agent.

---

## Goal

Let OpenPay users **send OUSD to OpenPay Pro users**, mirroring how OpenPay Pro sends out via OpenPay Pay / partner transfers.

Destination is an OpenPay Pro `@username` (or user id). Funds route through the partner app tag (e.g. `@wainfoundation`) with a structured note, then OpenPay Pro credits the right wallet.

## Note format (required)

```
pro_xfer:@PRO_USERNAME:REF
```

Examples:

- `pro_xfer:@alice:r_k7x2m1`
- `pro_xfer:uid_4aaba6a3-…:r_k7x2m1`

## UX on OpenPay Send

1. Add destination type / tab: **OpenPay Pro**.
2. Fields: Pro `@username` (required), amount (OUSD), optional memo.
3. Preview: “Sends to OpenPay Pro @alice via OpenPay”.
4. On confirm:
   - Check sender OpenPay wallet balance.
   - Debit sender (existing `send-money` / `transfer_funds_authenticated`).
   - Credit **partner app owner** account used by OpenPay Pro (same as PayButton / `/pay/@wainfoundation` recipient), **or** send to that user’s profile id with the `pro_xfer:` note.
   - Call OpenPay Pro inbound API (below) so Pro credits `@alice` immediately.
   - Show thank-you → optional deep link back if `success_url` provided.

## Pro inbound API (call after successful debit)

```
POST https://openpaypromainnet.lovable.app/api/public/openpay/inbound
Authorization: Bearer opk_live_PARTNER_KEY
Content-Type: application/json

{
  "to": "@alice",
  "amount": 25.00,
  "openpay_tx_id": "<openpay_transaction_uuid>",
  "note": "pro_xfer:@alice:r_k7x2m1",
  "from_username": "<sender_openpay_username>"
}
```

Store `OPENPAY_PRO_INBOUND_URL` + partner key in OpenPay secrets (server-only).

## Alternate (no API call): hosted pay link

If you prefer not to call Pro from Send:

```
https://openpy.space/pay/wainfoundation
  ?amount=25.00
  &currency=OUSD
  &note=pro_xfer:@alice:r_xxx
  &success_url=https://openpaypromainnet.lovable.app/receive?openpay_in=1&amount=25.00
  &cancel_url=https://openpaypromainnet.lovable.app/receive?openpay_cancel=1
```

Reuse the existing Pro top-up pay flow (`UsernamePayPage` one-click when note starts with `pro_xfer:` **or** `pro_topup_` / has `success_url`).

Extend UsernamePayPage: treat `note` starting with `pro_xfer:` like partner top-up (balance check → debit → thank-you → redirect). After payment, Pro settle/inbound credits `@alice`.

## Acceptance

- [ ] OpenPay Send → OpenPay Pro @user → Pro wallet balance increases
- [ ] Wrong / unknown Pro user → clear error (inbound API 400)
- [ ] Duplicate `openpay_tx_id` → no double credit
- [ ] Insufficient OpenPay balance → blocked before send
- [ ] Cancel returns to cancel_url without crediting Pro

## Do not

- Do not expose partner API key in the browser
- Do not force-push / rewrite git history
- Prefer `OP…` / explicit Pro username over fragile email lookups

---

Reference on Pro: `docs/OPENPAY_TO_PRO.md`, live docs `/docs/openpay`.
