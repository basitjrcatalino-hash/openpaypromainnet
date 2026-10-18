# Errors & retries — OpenPay Pro

Live page: [`/docs/errors`](https://openpaypro.space/docs/errors)

## Partner Transfer API

| Status | Meaning | Action |
|--------|---------|--------|
| 401 | Missing / invalid / revoked key | Rotate key; never expose in clients |
| 403 | Origin not whitelisted | Allowlist exact redirect / Origin |
| 404 | Recipient or charge not found | Resolve account; verify charge id |
| 400 | Validation / insufficient balance | Fix request; fund hot wallet |
| 5xx | Upstream | Backoff; reuse `Idempotency-Key` on transfers |

## Charges

No partner webhooks. Poll `GET /charges/:id` until `paid` | `canceled` | `expired` (2h TTL).

## MCP

`Not authenticated` → finish OAuth. Tool errors return `isError: true` with a text message.
