import { createFileRoute } from "@tanstack/react-router";

/**
 * Alchemy Address Activity webhook — automatic crypto deposit detection.
 *
 * Configure in Alchemy: Webhook URL
 *   https://<your-domain>/api/public/alchemy-deposit-webhook
 * Secrets: ALCHEMY_WEBHOOK_SIGNING_KEY (required), ALCHEMY_AUTH_TOKEN +
 * ALCHEMY_WEBHOOK_ID[_<CHAINKEY>] (to auto-register new deposit addresses).
 *
 * Security: HMAC-verified, idempotent, and NEVER credits a balance. Deposits
 * are inserted as `pending`; the confirmation monitor re-verifies on-chain and
 * credits only after the required confirmations.
 */
export const Route = createFileRoute("/api/public/alchemy-deposit-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signingKey = (process.env.ALCHEMY_WEBHOOK_SIGNING_KEY || "").trim();
        if (!signingKey) {
          return Response.json({ error: "Webhook not configured" }, { status: 503 });
        }

        const raw = await request.text();
        const signature = request.headers.get("x-alchemy-signature") || "";
        const { createHmac, timingSafeEqual } = await import("node:crypto");
        const expected = createHmac("sha256", signingKey).update(raw, "utf8").digest("hex");
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { alchemyNetworkToChainKey } = await import("@/lib/deposit-address.server");
        const { syncDeposit, logDepositEvent } = await import("@/lib/deposit-gateway.server");
        const db = supabaseAdmin as any;

        const provider = "alchemy";
        const eventId = String(payload.id ?? payload.webhookId ?? crypto.randomUUID());

        // Idempotency — a replayed delivery is acknowledged, never reprocessed.
        const { error: dupErr } = await db.from("deposit_webhook_events").insert({
          provider,
          provider_event_id: eventId,
          event_type: payload.type ?? "ADDRESS_ACTIVITY",
          payload,
        });
        if (dupErr) {
          if (String(dupErr.code) === "23505") {
            return Response.json({ ok: true, duplicate: true });
          }
          return Response.json({ error: dupErr.message }, { status: 500 });
        }

        const activities: any[] = payload?.event?.activity ?? payload?.activity ?? [];
        const network = String(payload?.event?.network ?? payload?.network ?? "");
        const chainKey = alchemyNetworkToChainKey(network);

        let created = 0;
        const skipped: string[] = [];

        if (!chainKey) {
          skipped.push(`unsupported_network:${network}`);
        } else {
          const { data: chain } = await db
            .from("deposit_chains")
            .select("*")
            .eq("key", chainKey)
            .maybeSingle();

          if (!chain || !chain.is_enabled || chain.maintenance_mode) {
            skipped.push("chain_disabled");
          } else {
            for (const act of activities) {
              if (act?.removed === true) {
                skipped.push("reorged");
                continue;
              }
              const to = String(act?.toAddress ?? "").toLowerCase();
              const txHash = String(act?.hash ?? "");
              if (!to || !txHash) {
                skipped.push("incomplete_activity");
                continue;
              }

              const { data: addr } = await db
                .from("deposit_addresses")
                .select("*")
                .eq("chain_id", chain.id)
                .eq("is_active", true)
                .ilike("address", to)
                .maybeSingle();
              if (!addr?.user_id) {
                skipped.push("unknown_or_unassigned_address");
                continue;
              }

              const contract: string | null =
                act?.rawContract?.address ?? (act?.category === "token" ? act?.asset : null) ?? null;

              let query = db
                .from("deposit_tokens")
                .select("*")
                .eq("chain_id", chain.id)
                .eq("status", "active")
                .eq("deposit_enabled", true);
              query = contract
                ? query.ilike("contract_address", contract)
                : query.is("contract_address", null);
              const { data: token } = await query.maybeSingle();
              if (!token) {
                skipped.push("unsupported_token");
                continue;
              }

              const amount = Number(act?.value ?? 0);
              if (!(amount > 0)) {
                skipped.push("zero_amount");
                continue;
              }
              if (Number(token.min_deposit ?? 0) > 0 && amount < Number(token.min_deposit)) {
                skipped.push("below_minimum");
                continue;
              }

              const { data: exists } = await db
                .from("deposits")
                .select("id")
                .eq("chain_key", chain.key)
                .eq("tx_hash", txHash)
                .maybeSingle();
              if (exists) {
                skipped.push("duplicate_tx");
                continue;
              }

              const { data: wallet } = await db
                .from("wallets")
                .select("id")
                .eq("user_id", addr.user_id)
                .order("is_active", { ascending: false })
                .order("created_at", { ascending: true })
                .limit(1)
                .maybeSingle();

              const { data: dep, error: insErr } = await db
                .from("deposits")
                .insert({
                  user_id: addr.user_id,
                  wallet_id: wallet?.id ?? null,
                  chain_id: chain.id,
                  token_id: token.id,
                  chain_key: chain.key,
                  token_symbol: token.symbol,
                  tx_hash: txHash,
                  from_address: act?.fromAddress ?? null,
                  to_address: addr.address,
                  amount,
                  block_number: act?.blockNum ? parseInt(String(act.blockNum), 16) : null,
                  confirmations: 0,
                  required_confirmations: chain.required_confirmations,
                  status: "pending",
                })
                .select("id")
                .maybeSingle();
              if (insErr) {
                skipped.push(`insert_failed:${insErr.message}`);
                continue;
              }

              created += 1;
              await logDepositEvent(db, dep.id, "deposit.webhook_detected", {
                provider,
                network,
                txHash,
              });
              try {
                await db.from("ot_notifications").insert({
                  user_id: addr.user_id,
                  title: "Deposit detected",
                  body: `Incoming ${token.symbol} on ${chain.name} — waiting for confirmations.`,
                  href: "/deposit",
                });
              } catch {
                /* notification is best-effort */
              }
              // Re-verify on-chain; credits only when confirmations are met.
              try {
                await syncDeposit(db, dep.id);
              } catch (err) {
                console.error("[alchemy webhook] sync", (err as Error).message);
              }
            }
          }
        }

        await db
          .from("deposit_webhook_events")
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
            processing_error: skipped.length ? skipped.join(", ").slice(0, 500) : null,
          })
          .eq("provider", provider)
          .eq("provider_event_id", eventId);

        return Response.json({ ok: true, created, skipped });
      },
    },
  },
});
