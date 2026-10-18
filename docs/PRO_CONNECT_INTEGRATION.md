# OpenPay Pro Connect — Auth & Pay Integration

Native third-party integrations on **OpenPay Pro** (`openpaypro.space`):

1. **OpenPay Pro Auth** — OAuth 2.0 authorization-code sign-in (`/pro/authorize`)
2. **OpenPay Pro Pay** — charges paid from the user’s OUSD balance (`/pro/checkout/{id}`)

Live docs: https://openpaypro.space/docs/integrations  
Discovery: `GET https://openpaypro.space/api/public/pro/config`

Currency: **OUSD**. No charge webhooks — **poll** until `paid` | `canceled` | `expired`.

---

## Keys

| Prefix | Role |
| --- | --- |
| `opro_live_…` | Client ID (public) |
| `oprs_live_…` | Client secret (server only) |
| `oprc_…` | One-time authorization code |
| `oprat_…` | User access token (Bearer) |

Create apps in the Pro **Partner API** portal (`/partner-api`) — same idea as OpenPay’s `openpy.space/partner-api`. Enter app name, website, logo, and exact-match OAuth callback URIs. Never put secrets in `VITE_` env.

---

## Discovery

```http
GET /api/public/pro/config
```

Returns authorization, token, userinfo, balance, and charges endpoints plus `scopes_supported`: `profile`, `balance`, `payments`.

---

## OAuth

### Authorize

```
https://openpaypro.space/pro/authorize
  ?client_id=opro_live_…
  &redirect_uri=https://your.app/callback
  &scope=profile%20balance
  &state=RANDOM
```

Exact-match `redirect_uri` (trailing slash trimmed).

### Token

```http
POST /api/public/pro/oauth/token
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "oprc_…",
  "redirect_uri": "https://your.app/callback"
}
```

Response: `access_token`, `token_type`, `expires_in`, `scope`, `user_id`.

---

## User APIs (Bearer `oprat_…`)

```http
GET /api/public/pro/user/me
GET /api/public/pro/user/balance
```

Balance requires `balance` scope.

---

## Charges (client credentials)

```http
POST   /api/public/pro/charges
GET    /api/public/pro/charges
GET    /api/public/pro/charges/{id}
POST   /api/public/pro/charges/{id}/cancel
```

Create body:

```json
{
  "amount": 12.5,
  "description": "Premium plan",
  "reference": "ord_1001",
  "success_url": "https://your.app/paid",
  "cancel_url": "https://your.app/cancel",
  "expires_in": 1800
}
```

Response includes `checkout_url`. Default TTL 30 minutes (max 2 hours). Redirect the payer to `checkout_url`; poll `GET …/charges/{id}` until terminal.

Payment credits the **app owner’s** Pro OUSD wallet and debits the payer (double-pay safe).

---

## Related

- [Pro Pay merchant (Partner API)](https://openpaypro.space/docs/pro-pay)
- [OpenPay Partner Transfer](https://openpaypro.space/docs/api)
- [Errors & retries](https://openpaypro.space/docs/errors)
