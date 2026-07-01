import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

async function authorize(request: Request): Promise<true | Response> {
  const key =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (!key) return json({ error: "Missing x-api-key header" }, 401);
  if (process.env.LEDGER_MASTER_API_KEY && key === process.env.LEDGER_MASTER_API_KEY) return true;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("ledger_api_keys").select("id").eq("key_hash", sha256(key)).eq("active", true).maybeSingle();
  if (!data) return json({ error: "Invalid or inactive API key" }, 401);
  return true;
}

export const Route = createFileRoute("/api/public/ledger/entries/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        const auth = await authorize(request);
        if (auth !== true) return auth;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const isNum = /^\d+$/.test(params.id);
        const q = supabaseAdmin
          .from("ledger_entries")
          .select("id, sequence, tx_id, from_address, to_address, asset, amount, usd_value, type, status, tx_hash, memo, occurred_at");
        const { data, error } = await (isNum ? q.eq("sequence", Number(params.id)) : q.eq("id", params.id)).maybeSingle();
        if (error) return json({ error: error.message }, 500);
        if (!data) return json({ error: "Not found" }, 404);
        return json({ data });
      },
    },
  },
});
