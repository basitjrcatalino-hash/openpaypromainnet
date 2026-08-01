-- Account buckets: Funding = wallets.*_balance; Trading/P2P = wallet_account_balances.
-- Internal transfer + P2P escrow/sell checks use the P2P bucket.

create table if not exists public.wallet_account_balances (
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  account text not null check (account in ('trading', 'p2p')),
  asset text not null,
  balance numeric(38, 8) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  primary key (wallet_id, account, asset)
);

create index if not exists wallet_account_balances_wallet_idx
  on public.wallet_account_balances (wallet_id, account);

grant select on public.wallet_account_balances to authenticated;
grant all on public.wallet_account_balances to service_role;

alter table public.wallet_account_balances enable row level security;

drop policy if exists "wab_owner_select" on public.wallet_account_balances;
create policy "wab_owner_select" on public.wallet_account_balances
  for select to authenticated
  using (
    exists (
      select 1 from public.wallets w
      where w.id = wallet_id and w.user_id = auth.uid()
    )
  );

-- Keep funding column helper (shared with P2P assets).
create or replace function public.p2p_balance_column(_asset text)
returns text
language sql
immutable
set search_path = public
as $$
  select case upper(_asset)
    when 'OUSD' then 'ousd_balance'
    when 'USDC' then 'usdc_balance'
    when 'USDT' then 'usdt_balance'
    when 'ETH'  then 'eth_balance'
    when 'BTC'  then 'btc_balance'
    when 'SOL'  then 'sol_balance'
    when 'PI'   then 'pi_balance'
    when 'PYUSD' then 'pyusd_balance'
    when 'EURC' then 'eurc_balance'
    when 'USDG' then 'usdg_balance'
    when 'USD1' then 'usd1_balance'
    when 'CASH' then 'cash_balance'
    else null end
$$;

-- Move delta on Trading/P2P bucket (creates row if needed).
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
  if a not in ('trading', 'p2p') then
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

-- Move delta on Funding (wallets columns).
create or replace function public.funding_move(
  _wallet_id uuid,
  _asset text,
  _delta numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  col text;
  bal numeric;
begin
  col := public.p2p_balance_column(_asset);
  if col is null then raise exception 'Unsupported asset %', _asset; end if;
  execute format('select coalesce(%I, 0) from public.wallets where id = $1 for update', col)
    into bal using _wallet_id;
  if bal is null then raise exception 'Wallet not found'; end if;
  if bal + _delta < 0 then
    raise exception 'Insufficient % balance in funding account', upper(_asset);
  end if;
  execute format('update public.wallets set %I = coalesce(%I, 0) + $1 where id = $2', col, col)
    using _delta, _wallet_id;
end;
$$;

revoke all on function public.funding_move(uuid, text, numeric)
  from public, anon, authenticated;

-- P2P escrow now debits/credits the P2P account bucket (not Funding columns).
create or replace function public.p2p_move_balance(_user_id uuid, _asset text, _delta numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wid uuid;
begin
  if public.p2p_balance_column(_asset) is null then
    raise exception 'Unsupported asset %', _asset;
  end if;
  select id into wid
  from public.wallets
  where user_id = _user_id
  order by is_active desc, created_at asc
  limit 1;
  if wid is null then raise exception 'No wallet found for participant'; end if;
  perform public.account_bucket_move(wid, 'p2p', upper(_asset), _delta);
end;
$$;

revoke all on function public.p2p_move_balance(uuid, text, numeric)
  from public, anon, authenticated;

-- Internal Funding ↔ Trading ↔ P2P transfer.
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
    'xfer_' || encode(gen_random_bytes(12), 'hex')
  );

  insert into public.transactions (
    wallet_id, type, status, token_symbol, amount, usd_value, counterparty, memo, tx_hash
  ) values (
    wid, 'receive', 'confirmed', asset_u, amt, 0,
    initcap(from_a), memo_txt,
    'xfer_' || encode(gen_random_bytes(12), 'hex')
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

-- Sell ads must be covered by P2P bucket (not Funding).
create or replace function public.p2p_create_ad(
  _side public.p2p_ad_side,
  _asset text,
  _price_usd numeric,
  _total_amount numeric,
  _min_order numeric,
  _max_order numeric,
  _payment_methods text[],
  _pay_time_limit_minutes int default 15,
  _terms text default null
)
returns public.p2p_ads
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  bal numeric;
  reserved numeric;
  ad public.p2p_ads;
  missing text;
  wid uuid;
  asset_u text := upper(_asset);
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if not public.p2p_merchant_can_list(uid) then
    raise exception
      'Merchant approval required. Apply in P2P → Become a Super Merchant / Apply as merchant, then wait for admin approval before listing ads.';
  end if;

  if _price_usd <= 0 or _total_amount <= 0 then raise exception 'Invalid amount'; end if;
  if _min_order <= 0 or _max_order < _min_order then raise exception 'Invalid order limits'; end if;
  if _max_order > _total_amount then raise exception 'Max order cannot exceed total amount'; end if;
  if coalesce(array_length(_payment_methods, 1), 0) = 0 then
    raise exception 'Select at least one payment method';
  end if;
  if public.p2p_balance_column(asset_u) is null then
    raise exception 'Unsupported asset %', asset_u;
  end if;

  perform public.p2p_assert_trade_limit(asset_u, _total_amount, _price_usd, 'ad total');
  perform public.p2p_assert_trade_limit(asset_u, _max_order, _price_usd, 'max order');
  perform public.p2p_assert_trade_limit(asset_u, _min_order, _price_usd, 'min order');

  if _side = 'sell' then
    select string_agg(m, ', ')
      into missing
    from unnest(_payment_methods) as m
    where not exists (
      select 1 from public.p2p_payment_accounts a
      where a.user_id = uid and a.method_code = m and a.is_active = true
    );
    if missing is not null then
      raise exception
        'Add merchant wallet receive details for: %. Open P2P → Merchant wallet first.',
        missing;
    end if;

    select id into wid
    from public.wallets
    where user_id = uid
    order by is_active desc, created_at asc
    limit 1;
    if wid is null then
      raise exception 'No wallet found — transfer funds into P2P first';
    end if;

    select coalesce(balance, 0) into bal
    from public.wallet_account_balances
    where wallet_id = wid and account = 'p2p' and asset = asset_u;
    bal := coalesce(bal, 0);

    select coalesce(sum(available_amount), 0) into reserved
    from public.p2p_ads
    where user_id = uid and side = 'sell' and status = 'active' and upper(asset) = asset_u;

    if bal - reserved < _total_amount then
      raise exception
        'Insufficient % in P2P account. Transfer from Funding first. Available for new ads: % (P2P % − reserved %).',
        asset_u,
        greatest(bal - reserved, 0),
        bal,
        reserved;
    end if;
  end if;

  insert into public.p2p_ads (
    user_id, side, asset, price_usd, total_amount, available_amount,
    min_order, max_order, payment_methods, pay_time_limit_minutes, terms
  ) values (
    uid, _side, asset_u, _price_usd, _total_amount, _total_amount,
    _min_order, _max_order, _payment_methods, _pay_time_limit_minutes, nullif(trim(_terms), '')
  )
  returning * into ad;
  return ad;
end;
$$;

grant execute on function public.p2p_create_ad(
  public.p2p_ad_side, text, numeric, numeric, numeric, numeric, text[], int, text
) to authenticated;
