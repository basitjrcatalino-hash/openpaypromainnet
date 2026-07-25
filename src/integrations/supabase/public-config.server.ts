/**
 * Public (non-secret) Supabase config for SSR → browser bootstrap.
 * Safe to expose: project URL + publishable/anon key only.
 */
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

export function getPublicSupabaseConfig(): {
  url: string | null;
  publishableKey: string | null;
} {
  let url = getSupabaseUrl() ?? null;
  if (!url) {
    const id = (
      process.env.SUPABASE_PROJECT_ID ||
      process.env.VITE_SUPABASE_PROJECT_ID ||
      ""
    ).trim();
    if (id) url = `https://${id}.supabase.co`;
  }
  const publishableKey = getSupabasePublishableKey() ?? null;
  return { url, publishableKey };
}
