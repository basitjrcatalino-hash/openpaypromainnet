-- Add Spot trading account bucket (alongside Funding, Futures/Trading, P2P).
-- Spot trades settle against the spot bucket; users Transfer Funding → Spot to trade Spot.

-- 1) Expand wallet_account_balances account check
alter table public.wallet_account_balances
  drop constraint if exists wallet_account_balances_account_check;

alter table public.wallet_account_balances
  add constraint wallet_account_balances_account_check
  check (account in ('trading', 'p2p', 'spot'));

-- 2) Expand transfer history checks
alter table public.account_transfer_events
  drop constraint if exists account_transfer_events_from_account_check;

alter table public.account_transfer_events
  drop constraint if exists account_transfer_events_to_account_check;

alter table public.account_transfer_events
  add constraint account_transfer_events_from_account_check
  check (from_account in ('funding', 'trading', 'p2p', 'spot'));

alter table public.account_transfer_events
  add constraint account_transfer_events_to_account_check
  check (to_account in ('funding', 'trading', 'p2p', 'spot'));

-- 3) account_bucket_move allows spot
create or replace function public.account_bucket_move(
  _wallet_id uuid,
  _account text,
  _asset text,
  _delta numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bal numeric;
  a text := lower(_account);
  asset_u text := upper(_asset);
begin
  if a not in ('trading', 'p2p', 'spot') then
    raise exception 'Invalid account bucket %', _account;
  end if;
  if public.p2p_balance_column(asset_u) is null then
    raise exception 'Unsupported asset %', asset_u;
  end if;

  insert into public.wallet_account_balances (wallet_id, account, asset, balance)
  values (_wallet_id, a, asset_u, 0)
  on conflict (wallet_id, account, asset) do nothing;

  select balance into bal
  from public.wallet_account_balances
  where wallet_id = _wallet_id and account = a and asset = asset_u
  for update;

  if bal + _delta < 0 then
    raise exception 'Insufficient % balance in % account', asset_u, a;
  end if;

  update public.wallet_account_balances
  set balance = balance + _delta, updated_at = now()
  where wallet_id = _wallet_id and account = a and asset = asset_u;
end;
$$;

revoke all on function public.account_bucket_move(uuid, text, text, numeric)
  from public, anon, authenticated;

-- 4) internal_account_transfer includes spot
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
  send_hash text;
  recv_hash text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if from_a = to_a then raise exception 'From and To accounts must differ'; end if;
  if from_a not in ('funding', 'trading', 'p2p', 'spot')
     or to_a not in ('funding', 'trading', 'p2p', 'spot') then
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
  send_hash := 'xfer_' || replace(gen_random_uuid()::text, '-', '');
  recv_hash := 'xfer_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.transactions (
    wallet_id, type, status, token_symbol, amount, usd_value, counterparty, memo, tx_hash
  ) values (
    wid, 'send', 'confirmed', asset_u, amt, 0,
    initcap(to_a), memo_txt, send_hash
  );

  insert into public.transactions (
    wallet_id, type, status, token_symbol, amount, usd_value, counterparty, memo, tx_hash
  ) values (
    wid, 'receive', 'confirmed', asset_u, amt, 0,
    initcap(from_a), memo_txt, recv_hash
  );

  insert into public.account_transfer_events (
    wallet_id, user_id, from_account, to_account, asset, amount
  ) values (
    wid, uid, from_a, to_a, asset_u, amt
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

-- 5) Portfolio includes spot
create or replace function public.get_account_portfolio()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  wid uuid;
  w record;
  funding jsonb := '{}'::jsonb;
  trading jsonb := '{}'::jsonb;
  p2p jsonb := '{}'::jsonb;
  spot jsonb := '{}'::jsonb;
  r record;
  col text;
  assets text[] := array[
    'OUSD','USDT','USDC','PYUSD','USDG','USD1','CASH','EURC',
    'ETH','BTC','SOL','PI','HYPE','ZEC','TSLAX','NFLXX','GOOGLX',
    'BNB','UNI','OKB','GT','BGB','CAKE','JUP','RON',
    'XRP','TRX','DOGE','ADA','LINK','XLM','BCH',
    'GRAM','AVAX','SUI','XAUT','ONDO','NEAR',
    'USDY','PAXG','WLFI','ASTER','RLUSD','AAVE','DOT','PUMP'
  ];
  a text;
  bal numeric;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into w
  from public.wallets
  where user_id = uid
  order by is_active desc, created_at asc
  limit 1;
  if w.id is null then
    return jsonb_build_object(
      'wallet_id', null,
      'funding', funding,
      'trading', trading,
      'p2p', p2p,
      'spot', spot
    );
  end if;
  wid := w.id;

  foreach a in array assets loop
    col := public.p2p_balance_column(a);
    if col is null then continue; end if;
    execute format('select coalesce(%I, 0) from public.wallets where id = $1', col)
      into bal using wid;
    funding := funding || jsonb_build_object(a, bal);
  end loop;

  for r in
    select account, asset, balance
    from public.wallet_account_balances
    where wallet_id = wid and account in ('trading', 'p2p', 'spot')
  loop
    if r.account = 'trading' then
      trading := trading || jsonb_build_object(upper(r.asset), r.balance);
    elsif r.account = 'p2p' then
      p2p := p2p || jsonb_build_object(upper(r.asset), r.balance);
    else
      spot := spot || jsonb_build_object(upper(r.asset), r.balance);
    end if;
  end loop;

  foreach a in array assets loop
    if not (trading ? a) then trading := trading || jsonb_build_object(a, 0); end if;
    if not (p2p ? a) then p2p := p2p || jsonb_build_object(a, 0); end if;
    if not (spot ? a) then spot := spot || jsonb_build_object(a, 0); end if;
  end loop;

  return jsonb_build_object(
    'wallet_id', wid,
    'funding', funding,
    'trading', trading,
    'p2p', p2p,
    'spot', spot
  );
end;
$$;

grant execute on function public.get_account_portfolio() to authenticated;

-- Silent bridge Spot ↔ Funding for Spot trade settlement (no transfer-history rows).
create or replace function public.spot_funding_bridge(
  _direction text,
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
  dir text := lower(trim(_direction));
  asset_u text := upper(trim(_asset));
  amt numeric := round(_amount::numeric, 8);
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if dir not in ('spot_to_funding', 'funding_to_spot') then
    raise exception 'Invalid bridge direction';
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

  if dir = 'spot_to_funding' then
    perform public.account_bucket_move(wid, 'spot', asset_u, -amt);
    perform public.funding_move(wid, asset_u, amt);
  else
    perform public.funding_move(wid, asset_u, -amt);
    perform public.account_bucket_move(wid, 'spot', asset_u, amt);
  end if;

  return jsonb_build_object(
    'ok', true,
    'direction', dir,
    'asset', asset_u,
    'amount', amt
  );
end;
$$;

grant execute on function public.spot_funding_bridge(text, text, numeric)
  to authenticated;
