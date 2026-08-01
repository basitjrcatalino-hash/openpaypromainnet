/**
 * One-shot: apply P2P escrow fix against remote Supabase using the service role.
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."; node scripts/apply-p2p-fix.mjs
 *
 * Or with DATABASE_URL:
 *   $env:DATABASE_URL="postgresql://..."; node scripts/apply-p2p-fix.mjs
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const sql = [
  "supabase/migrations/20260801110000_p2p_fix_escrow_refs.sql",
  "supabase/migrations/20260801120000_p2p_trader_stats.sql",
  "supabase/migrations/20260801130000_p2p_merchant_payment_accounts.sql",
  "supabase/migrations/20260801140000_p2p_max_amount_limit.sql",
  "supabase/migrations/20260801150000_p2p_admin_set_support.sql",
  "supabase/migrations/20260801160000_p2p_realtime_notifications.sql",
]
  .map((rel) => readFileSync(join(root, rel), "utf8"))
  .join("\n\n");

function loadEnv() {
  try {
    const raw = readFileSync(join(root, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SECRET ||
  "";

async function viaPgMeta() {
  if (!url || !serviceKey) {
    throw new Error("Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)");
  }
  // Internal postgres-meta used by Supabase Studio (works with service role on many projects)
  const endpoints = [
    `${url}/pg/query`,
    `https://api.supabase.com/v1/projects/${process.env.VITE_SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID}/database/query`,
  ];
  let lastErr = null;
  for (const endpoint of endpoints) {
    try {
      const headers = {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      };
      if (endpoint.includes("api.supabase.com")) {
        const token = process.env.SUPABASE_ACCESS_TOKEN;
        if (!token) continue;
        headers.Authorization = `Bearer ${token}`;
        delete headers.apikey;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: sql }),
      });
      const text = await res.text();
      if (!res.ok) {
        lastErr = new Error(`${endpoint} → ${res.status}: ${text.slice(0, 400)}`);
        continue;
      }
      console.log("Applied via", endpoint);
      console.log(text.slice(0, 500));
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No endpoint succeeded");
}

async function main() {
  await viaPgMeta();
}

main().catch((e) => {
  console.error(e.message || e);
  console.error("\nAdd SUPABASE_SERVICE_ROLE_KEY to .env and re-run, or paste the migration SQL in the Supabase SQL editor.");
  process.exit(1);
});
