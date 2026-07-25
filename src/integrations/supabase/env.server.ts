/**
 * Server-only Supabase admin env. Never import from client/browser modules.
 *
 * Vercel ↔ Supabase sets `SUPABASE_SECRET_KEY` instead of legacy
 * `SUPABASE_SERVICE_ROLE_KEY`.
 */
import { getSupabaseUrl, missingSupabaseEnvMessage } from "./env";

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return undefined;
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return firstNonEmpty(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_KEY,
  );
}

export function hasSupabaseAdminEnv(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

export { getSupabaseUrl, missingSupabaseEnvMessage };
