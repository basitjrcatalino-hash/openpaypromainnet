import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

async function authorize(request: Request): Promise<{ ok: true } | Response> {
  const key =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (!key) return json({ error: "Missing x-api-key header" }, 401);

  const master = process.env.LEDGER_MASTER_API_KEY;
  if (master && key === master) return { ok: true };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("ledger_api_keys")
    .select("id, active")
    .eq("key_hash", sha256(key))
    .eq("active", true)
    .maybeSingle();
  if (!data) return json({ error: "Invalid or inactive API key" }, 401);

  await supabaseAdmin
    .from("ledger_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { ok: true };
}

export const Route = createFileRoute("/api/public/ledger/entries")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const auth = await authorize(request);
        if (auth instanceof Response) return auth;

        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
        const cursor = url.searchParams.get("cursor"); // sequence number
        const asset = url.searchParams.get("asset");
        const type = url.searchParams.get("type");
        const address = url.searchParams.get("address");
        const since = url.searchParams.get("since");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let q = supabaseAdmin
          .from("ledger_entries")
          .select(
            "id, sequence, tx_id, from_address, to_address, asset, amount, usd_value, type, status, tx_hash, memo, occurred_at"
          )
          .order("sequence", { ascending: false })
          .limit(limit);

        if (cursor) q = q.lt("sequence", Number(cursor));
        if (asset) q = q.eq("asset", asset);
        if (type) q = q.eq("type", type);
        if (since) q = q.gte("occurred_at", since);
        if (address) q = q.or(`from_address.eq.${address},to_address.eq.${address}`);

        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);

        const next = data && data.length === limit ? String(data[data.length - 1].sequence) : null;
        return json({ data, next_cursor: next, count: data?.length ?? 0 });
      },
    },
  },
});
