import { createFileRoute } from "@tanstack/react-router";

/**
 * One-shot internal transfer repair (gen_random_bytes → gen_random_uuid).
 * POST with header `x-webhook-secret: ${TX_WEBHOOK_SECRET}`.
 * Safe to call repeatedly (CREATE OR REPLACE).
 */
const FIX_SQL = `
-- Fix internal_account_transfer: replace pgcrypto gen_random_bytes with gen_random_uuid
-- (search_path = public hides extensions.gen_random_bytes on Supabase).

create or replace function public.internal_account_transfer(
  _from text,
  _to text,
  _asset text,
  _amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  wid uuid;
  from_a text := lower(trim(_from));
  to_a text := lower(trim(_to));
  asset_u text := upper(trim(_asset));
  amt numeric := round(_amount::numeric, 8);
  memo_txt text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if from_a = to_a then raise exception 'From and To accounts must differ'; end if;
  if from_a not in ('funding', 'trading', 'p2p') or to_a not in ('funding', 'trading', 'p2p') then
    raise exception 'Invalid account';
  end if;
  if amt is null or amt <= 0 then raise exception 'Amount must be positive'; end if;
  if public.p2p_balance_column(asset_u) is null then
    raise exception 'Unsupported asset %', asset_u;
  end if;

  select id into wid
  from public.wallets
  where user_id = uid
  order by is_active desc, created_at asc
  limit 1
  for update;
  if wid is null then raise exception 'No wallet found'; end if;

  if from_a = 'funding' then
    perform public.funding_move(wid, asset_u, -amt);
  else
    perform public.account_bucket_move(wid, from_a, asset_u, -amt);
  end if;

  if to_a = 'funding' then
    perform public.funding_move(wid, asset_u, amt);
  else
    perform public.account_bucket_move(wid, to_a, asset_u, amt);
  end if;

  memo_txt := format('acct_xfer:%s→%s', from_a, to_a);

  insert into public.transactions (
    wallet_id, type, status, token_symbol, amount, usd_value, counterparty, memo, tx_hash
  ) values (
    wid, 'send', 'confirmed', asset_u, amt, 0,
    initcap(to_a), memo_txt,
    'xfer_' || replace(gen_random_uuid()::text, '-', '')
  );

  insert into public.transactions (
    wallet_id, type, status, token_symbol, amount, usd_value, counterparty, memo, tx_hash
  ) values (
    wid, 'receive', 'confirmed', asset_u, amt, 0,
    initcap(from_a), memo_txt,
    'xfer_' || replace(gen_random_uuid()::text, '-', '')
  );

  return jsonb_build_object(
    'ok', true,
    'from', from_a,
    'to', to_a,
    'asset', asset_u,
    'amount', amt
  );
end;
$$;

grant execute on function public.internal_account_transfer(text, text, text, numeric)
  to authenticated;
`;

export const Route = createFileRoute("/api/admin/transfer-fix")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const secret = process.env.TX_WEBHOOK_SECRET?.trim();
          const hdr = request.headers.get("x-webhook-secret") || "";
          if (!secret) {
            return Response.json({ error: "Webhook not configured" }, { status: 503 });
          }
          if (hdr !== secret) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(
            /\/$/,
            "",
          );
          const serviceKey =
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
            process.env.SUPABASE_SECRET_KEY ||
            process.env.SUPABASE_SERVICE_KEY ||
            "";
          if (!url || !serviceKey) {
            return Response.json({ error: "Supabase admin env missing" }, { status: 503 });
          }

          const projectId =
            process.env.SUPABASE_PROJECT_ID || process.env.VITE_SUPABASE_PROJECT_ID || "";
          const dbUrl =
            process.env.DATABASE_URL ||
            process.env.POSTGRES_URL ||
            process.env.POSTGRES_PRISMA_URL ||
            process.env.DIRECT_URL ||
            "";

          if (dbUrl) {
            try {
              const { default: postgres } = await import("postgres");
              const sqlClient = postgres(dbUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
              try {
                await sqlClient.unsafe(FIX_SQL);
                return Response.json({ ok: true, via: "database_url" });
              } finally {
                await sqlClient.end({ timeout: 5 });
              }
            } catch (e) {
              console.warn("[transfer-fix] database_url path failed:", (e as Error).message);
            }
          }

          const attempts: Array<{ endpoint: string; headers: Record<string, string>; body: unknown }> =
            [
              {
                endpoint: `${url}/pg/query`,
                headers: {
                  "Content-Type": "application/json",
                  apikey: serviceKey,
                  Authorization: `Bearer ${serviceKey}`,
                },
                body: { query: FIX_SQL },
              },
            ];

          if (process.env.SUPABASE_ACCESS_TOKEN && projectId) {
            attempts.push({
              endpoint: `https://api.supabase.com/v1/projects/${projectId}/database/query`,
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
              },
              body: { query: FIX_SQL },
            });
          }

          const errors: string[] = [];
          for (const attempt of attempts) {
            const res = await fetch(attempt.endpoint, {
              method: "POST",
              headers: attempt.headers,
              body: JSON.stringify(attempt.body),
            });
            const text = await res.text();
            if (res.ok) {
              return Response.json({
                ok: true,
                via: attempt.endpoint,
                detail: text.slice(0, 1000),
              });
            }
            errors.push(`${attempt.endpoint} → ${res.status}: ${text.slice(0, 300)}`);
          }

          return Response.json({ error: "All SQL endpoints failed", errors }, { status: 502 });
        } catch (err) {
          console.error("[transfer-fix]", err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
