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

  -- Debit From
  if from_a = 'funding' then
    perform public.funding_move(wid, asset_u, -amt);
  else
    perform public.account_bucket_move(wid, from_a, asset_u, -amt);
  end if;

  -- Credit To
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
