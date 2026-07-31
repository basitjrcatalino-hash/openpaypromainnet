import { createFileRoute } from "@tanstack/react-router";

/**
 * Public payment gateway API.
 * GET /api/public/payments/chains — supported blockchains + tokens.
 */
export const Route = createFileRoute("/api/public/payments/chains")({
  server: {
    handlers: {
      GET: async () => {
        const { listGatewayCatalog } = await import("@/lib/payments-gateway.server");
        const { chains, tokens, addresses } = await listGatewayCatalog();
        return Response.json({
          chains: chains.map((c: any) => ({
            key: c.key,
            name: c.name,
            family: c.family,
            chain_id: c.chain_id,
            explorer_url: c.explorer_url,
            required_confirmations: c.required_confirmations,
            bridge_status: c.bridge_status,
            paused: c.maintenance_mode,
            receiving_configured: addresses.some((a: any) => a.chain_id === c.id),
            tokens: tokens
              .filter((t: any) => t.chain_id === c.id)
              .map((t: any) => ({
                symbol: t.symbol,
                name: t.name,
                contract_address: t.contract_address,
                decimals: t.decimals,
                min_amount: Number(t.min_deposit),
                max_amount: t.max_deposit === null ? null : Number(t.max_deposit),
                fee_bps: t.deposit_fee_bps,
              })),
          })),
        });
      },
    },
  },
});
