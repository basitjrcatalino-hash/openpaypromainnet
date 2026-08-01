-- Durable account-transfer history + portfolio helpers for OKX-style Assets.
-- Funding = wallets.*_balance; Trading/P2P = wallet_account_balances.

create table if not exists public.account_transfer_events (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account text not null check (from_account in ('funding', 'trading', 'p2p')),
  to_account text not null check (to_account in ('funding', 'trading', 'p2p')),
  asset text not null,
  amount numeric(38, 8) not null check (amount > 0),
  created_at timestamptz not null default now(),
  constraint account_transfer_events_distinct check (from_account <> to_account)
);

create index if not exists account_transfer_events_user_idx
  on public.account_transfer_events (user_id, created_at desc);

create index if not exists account_transfer_events_wallet_idx
  on public.account_transfer_events (wallet_id, created_at desc);

create index if not exists account_transfer_events_account_idx
  on public.account_transfer_events (wallet_id, from_account, created_at desc);

grant select on public.account_transfer_events to authenticated;
grant all on public.account_transfer_events to service_role;

alter table public.account_transfer_events enable row level security;

drop policy if exists "ate_owner_select" on public.account_transfer_events;
create policy "ate_owner_select" on public.account_transfer_events
  for select to authenticated
  using (user_id = auth.uid());

-- Rewrite transfer to also persist dedicated history rows.
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

-- Portfolio snapshot: funding columns + trading/p2p bucket rows for active wallet.
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
  r record;
  col text;
  assets text[] := array[
    'OUSD','USDT','USDC','PYUSD','USDG','USD1','CASH','EURC','ETH','BTC','SOL','PI'
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
      'p2p', p2p
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
    where wallet_id = wid and account in ('trading', 'p2p')
  loop
    if r.account = 'trading' then
      trading := trading || jsonb_build_object(upper(r.asset), r.balance);
    else
      p2p := p2p || jsonb_build_object(upper(r.asset), r.balance);
    end if;
  end loop;

  -- Fill missing trading/p2p keys with 0 for stable client shape.
  foreach a in array assets loop
    if not (trading ? a) then trading := trading || jsonb_build_object(a, 0); end if;
    if not (p2p ? a) then p2p := p2p || jsonb_build_object(a, 0); end if;
  end loop;

  return jsonb_build_object(
    'wallet_id', wid,
    'funding', funding,
    'trading', trading,
    'p2p', p2p
  );
end;
$$;

grant execute on function public.get_account_portfolio() to authenticated;
