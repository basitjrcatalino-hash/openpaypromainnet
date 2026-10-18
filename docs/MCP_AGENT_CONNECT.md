# Agent Connect · MCP — OpenPay Pro

Live page: [`/docs/mcp`](https://openpaypro.space/docs/mcp)

## Endpoint

- MCP: `https://openpaypro.space/mcp`
- List tools: `https://openpaypro.space/.mcp/list-tools`
- Invoke: `https://openpaypro.space/.mcp/invoke-tool/$tool`
- OAuth metadata: `https://openpaypro.space/.well-known/oauth-protected-resource`

## Tools (read-only)

| Tool | Inputs | Purpose |
|------|--------|---------|
| `get_profile` | — | Signed-in profile |
| `list_wallets` | — | Wallets + balances |
| `list_transactions` | `limit?` (1–100) | Recent activity |
| `list_ledger_entries` | `limit?`, `asset?` | Public ledger rows |

Money moves require Pro UI or Partner Transfer — MCP tools do not transfer funds.
