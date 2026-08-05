import { createFileRoute } from "@tanstack/react-router";
import {
  trustWalletConfigured,
  trustWalletSwapQuote,
} from "@/lib/trustwallet.server";

/**
 * POST Amber swap quote body — see Trust Wallet swap-quote docs.
 * Returns routes; does not broadcast txs (OpenPay ledger swap remains primary).
 */
export const Route = createFileRoute("/api/public/trustwallet-quote")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!trustWalletConfigured()) {
            return Response.json(
              { configured: false, error: "not_configured" },
              { status: 503 },
            );
          }
          const body = (await request.json().catch(() => null)) as Record<
            string,
            unknown
          > | null;
          if (
            !body?.fromAsset ||
            !body?.fromAddress ||
            !body?.fromDomain ||
            !body?.amount ||
            !body?.toAsset ||
            !body?.toDomain
          ) {
            return Response.json(
              {
                error:
                  "fromAsset, fromAddress, fromDomain, amount, toAsset, toDomain required",
              },
              { status: 400 },
            );
          }
          const res = await trustWalletSwapQuote({
            fromAsset: String(body.fromAsset),
            fromAddress: String(body.fromAddress),
            fromDomain: String(body.fromDomain),
            amount: String(body.amount),
            toAsset: String(body.toAsset),
            toDomain: String(body.toDomain),
            toAddress: body.toAddress ? String(body.toAddress) : undefined,
            slippage: body.slippage ? String(body.slippage) : undefined,
            sortBy: body.sortBy ? String(body.sortBy) : undefined,
            contractCall:
              typeof body.contractCall === "boolean"
                ? body.contractCall
                : undefined,
            preferredProviders: Array.isArray(body.preferredProviders)
              ? (body.preferredProviders as string[])
              : undefined,
            ignoredProviders: Array.isArray(body.ignoredProviders)
              ? (body.ignoredProviders as string[])
              : undefined,
          });
          if (!res.ok) {
            return Response.json(
              { configured: true, error: res.error, data: res.data },
              { status: 502 },
            );
          }
          return Response.json({ configured: true, ...res.data });
        } catch (err) {
          console.error("[trustwallet-quote]", err);
          return Response.json(
            { error: (err as Error).message || "quote failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
