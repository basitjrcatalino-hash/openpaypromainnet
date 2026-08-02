-- Complete OpenPay Pro trading backend (Spot + Perps foundation).
-- Builds on spot_orders + perp_positions with secure RPCs, fills ledger, favorites, realtime.

-- ---------------------------------------------------------------------------
-- 1) Spot orders: harden columns + updated_at trigger
-- ---------------------------------------------------------------------------
alter table public.spot_orders
  add column if not exists avg_fill_price numeric(38, 8),
  add column if not exists client_order_id text,
  add column if not exists reduce_only boolean not null default false,
  add column if not exists time_in_force text not null default 'GTC'
    check (time_in_force in ('GTC', 'IOC', 'FOK'));

create unique index if not exists spot_orders_client_order_uidx
  on public.spot_orders (user_id, client_order_id)
  where client_order_id is not null;

create or replace function public.spot_orders_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_spot_orders_updated_at on public.spot_orders;
create trigger trg_spot_orders_updated_at
  before update on public.spot_orders
  for each row execute function public.spot_orders_set_updated_at();

-- Users may SELECT only; mutations go through security-definer RPCs
drop policy if exists "spot_orders_owner_insert" on public.spot_orders;
drop policy if exists "spot_orders_owner_update" on public.spot_orders;
revoke insert, update, delete on public.spot_orders from authenticated;
grant select on public.spot_orders to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Spot fills (trade history per order)
-- ---------------------------------------------------------------------------
create table if not exists public.spot_fills (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.spot_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  market text not null check (market in ('BTC', 'ETH', 'SOL', 'PI')),
  side text not null check (side in ('buy', 'sell')),
  price numeric(38, 8) not null check (price > 0),
  amount numeric(38, 8) not null check (amount > 0),
  quote_amount numeric(38, 8) not null check (quote_amount >= 0),
  fee_usd numeric(38, 8) not null default 0,
  pay_asset text not null check (pay_asset in ('USDT', 'OUSD', 'USDC')),
  mark_price numeric(38, 8),
  tx_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists spot_fills_user_created_idx
  on public.spot_fills (user_id, created_at desc);

create index if not exists spot_fills_order_idx
  on public.spot_fills (order_id, created_at desc);

create index if not exists spot_fills_market_idx
  on public.spot_fills (market, created_at desc);

alter table public.spot_fills enable row level security;

drop policy if exists "spot_fills_owner_select" on public.spot_fills;
create policy "spot_fills_owner_select" on public.spot_fills
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.spot_fills to authenticated;
grant all on public.spot_fills to service_role;

-- ---------------------------------------------------------------------------
-- 3) Trade pair favorites (server-side; complements localStorage)
-- ---------------------------------------------------------------------------
create table if not exists public.trade_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  market text not null check (market in ('BTC', 'ETH', 'SOL', 'PI')),
  created_at timestamptz not null default now(),
  primary key (user_id, market)
);

alter table public.trade_favorites enable row level security;

drop policy if exists "trade_favorites_owner_all" on public.trade_favorites;
create policy "trade_favorites_owner_all" on public.trade_favorites
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, delete on public.trade_favorites to authenticated;
grant all on public.trade_favorites to service_role;

-- ---------------------------------------------------------------------------
-- 4) Perp extras: liquidation price snapshot + funding events (Phase 2 ready)
-- ---------------------------------------------------------------------------
alter table public.perp_positions
  add column if not exists liquidation_price numeric(38, 8),
  add column if not exists margin_mode text not null default 'isolated'
    check (margin_mode in ('isolated', 'cross')),
  add column if not exists position_mode text not null default 'hedge'
    check (position_mode in ('one_way', 'hedge'));

create table if not exists public.perp_funding_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  position_id uuid references public.perp_positions(id) on delete set null,
  market text not null check (market in ('BTC', 'ETH', 'SOL', 'PI')),
  funding_rate numeric(38, 12) not null,
  payment numeric(38, 8) not null,
  mark_price numeric(38, 8),
  created_at timestamptz not null default now()
);

create index if not exists perp_funding_user_idx
  on public.perp_funding_payments (user_id, created_at desc);

alter table public.perp_funding_payments enable row level security;

drop policy if exists "perp_funding_owner_select" on public.perp_funding_payments;
create policy "perp_funding_owner_select" on public.perp_funding_payments
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.perp_funding_payments to authenticated;
grant all on public.perp_funding_payments to service_role;

-- ---------------------------------------------------------------------------
-- 5) Spot RPCs
-- ---------------------------------------------------------------------------
create or replace function public.spot_place_limit_order(
  _market text,
  _side text,
  _price numeric,
  _amount numeric,
  _pay_asset text,
  _client_order_id text default null
)
returns public.spot_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  wid uuid;
  market_u text := upper(trim(_market));
  side_l text := lower(trim(_side));
  pay_u text := upper(trim(_pay_asset));
  price_n numeric := round(_price::numeric, 8);
  amount_n numeric := round(_amount::numeric, 8);
  ord public.spot_orders;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if market_u not in ('BTC', 'ETH', 'SOL', 'PI') then
    raise exception 'Unsupported market';
  end if;
  if side_l not in ('buy', 'sell') then raise exception 'Side must be buy or sell'; end if;
  if pay_u not in ('USDT', 'OUSD', 'USDC') then
    raise exception 'Pay asset must be USDT, OUSD, or USDC';
  end if;
  if price_n is null or price_n <= 0 then raise exception 'Invalid price'; end if;
  if amount_n is null or amount_n <= 0 then raise exception 'Invalid amount'; end if;

  select id into wid
  from public.wallets
  where user_id = uid
  order by is_active desc, created_at asc
  limit 1
  for update;
  if wid is null then raise exception 'No wallet found'; end if;

  insert into public.spot_orders (
    user_id, wallet_id, market, side, order_type, price, amount, filled,
    pay_asset, status, client_order_id
  ) values (
    uid, wid, market_u, side_l, 'limit', price_n, amount_n, 0,
    pay_u, 'open', nullif(trim(coalesce(_client_order_id, '')), '')
  )
  returning * into ord;

  return ord;
end;
$$;

grant execute on function public.spot_place_limit_order(text, text, numeric, numeric, text, text)
  to authenticated;

create or replace function public.spot_cancel_order(_order_id uuid)
returns public.spot_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ord public.spot_orders;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  update public.spot_orders
  set status = 'cancelled', updated_at = now()
  where id = _order_id
    and user_id = uid
    and status in ('open', 'partial')
  returning * into ord;

  if not found then raise exception 'Order not found or not cancellable'; end if;
  return ord;
end;
$$;

grant execute on function public.spot_cancel_order(uuid) to authenticated;

-- Called by app after successful buyMajor / OpenDEX settlement against the limit.
create or replace function public.spot_complete_fill(
  _order_id uuid,
  _fill_price numeric,
  _fill_amount numeric,
  _fee_usd numeric default 0,
  _mark_price numeric default null,
  _tx_id uuid default null
)
returns public.spot_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ord public.spot_orders;
  fill_px numeric := round(_fill_price::numeric, 8);
  fill_amt numeric := round(_fill_amount::numeric, 8);
  fee_n numeric := round(coalesce(_fee_usd, 0)::numeric, 8);
  quote_n numeric;
  new_filled numeric;
  new_status text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if fill_px is null or fill_px <= 0 then raise exception 'Invalid fill price'; end if;
  if fill_amt is null or fill_amt <= 0 then raise exception 'Invalid fill amount'; end if;

  select * into ord
  from public.spot_orders
  where id = _order_id and user_id = uid
  for update;
  if not found then raise exception 'Order not found'; end if;
  if ord.status not in ('open', 'partial') then
    raise exception 'Order is not open';
  end if;

  quote_n := round(fill_px * fill_amt, 8);
  new_filled := round(ord.filled + fill_amt, 8);
  if new_filled > ord.amount + 1e-8 then
    raise exception 'Fill exceeds remaining amount';
  end if;

  if new_filled >= ord.amount then
    new_status := 'filled';
  else
    new_status := 'partial';
  end if;

  insert into public.spot_fills (
    order_id, user_id, wallet_id, market, side, price, amount, quote_amount,
    fee_usd, pay_asset, mark_price, tx_id
  ) values (
    ord.id, ord.user_id, ord.wallet_id, ord.market, ord.side, fill_px, fill_amt, quote_n,
    fee_n, ord.pay_asset, _mark_price, _tx_id
  );

  update public.spot_orders
  set filled = new_filled,
      status = new_status,
      avg_fill_price = case
        when coalesce(avg_fill_price, 0) <= 0 then fill_px
        else round(((coalesce(avg_fill_price, 0) * ord.filled) + (fill_px * fill_amt))
          / nullif(new_filled, 0), 8)
      end,
      filled_at = case when new_status = 'filled' then now() else filled_at end,
      updated_at = now()
  where id = ord.id
  returning * into ord;

  -- Ledger settlement is done by the app (buyMajor / OpenDEX) before this RPC.
  -- spot_fills is the canonical Trade History row for the order.

  return ord;
end;
$$;

grant execute on function public.spot_complete_fill(uuid, numeric, numeric, numeric, numeric, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Convenience views
-- ---------------------------------------------------------------------------
create or replace view public.v_spot_open_orders
with (security_invoker = true)
as
select *
from public.spot_orders
where status in ('open', 'partial');

create or replace view public.v_spot_trade_history
with (security_invoker = true)
as
select
  f.id,
  f.order_id,
  f.user_id,
  f.wallet_id,
  f.market,
  f.side,
  f.price,
  f.amount,
  f.quote_amount,
  f.fee_usd,
  f.pay_asset,
  f.created_at,
  o.order_type,
  o.status as order_status
from public.spot_fills f
join public.spot_orders o on o.id = f.order_id;

grant select on public.v_spot_open_orders to authenticated;
grant select on public.v_spot_trade_history to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Realtime (Trade dock live updates)
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.spot_orders;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.spot_fills;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.perp_positions;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 8) Perp RPCs: store liquidation price on open + record funding payments
-- ---------------------------------------------------------------------------
create or replace function public.perp_open_position(
  _market text,
  _side text,
  _leverage numeric,
  _margin_asset text,
  _margin numeric,
  _entry_price numeric
)
returns public.perp_positions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  wid uuid;
  market_u text := upper(trim(_market));
  side_l text := lower(trim(_side));
  asset_u text := upper(trim(_margin_asset));
  lev numeric := round(_leverage::numeric, 2);
  margin_n numeric := round(_margin::numeric, 8);
  entry numeric := _entry_price::numeric;
  size_n numeric;
  liq numeric;
  pos public.perp_positions;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if market_u not in ('BTC', 'ETH', 'SOL', 'PI') then
    raise exception 'Unsupported perpetual market';
  end if;
  if side_l not in ('long', 'short') then raise exception 'Side must be long or short'; end if;
  if asset_u not in ('USDT', 'OUSD', 'USDC') then
    raise exception 'Margin must be USDT, OUSD, or USDC';
  end if;
  if lev is null or lev < 1 or lev > 20 then raise exception 'Leverage must be 1–20×'; end if;
  if margin_n is null or margin_n <= 0 then raise exception 'Margin must be positive'; end if;
  if entry is null or entry <= 0 then raise exception 'Invalid entry price'; end if;

  select id into wid
  from public.wallets
  where user_id = uid
  order by is_active desc, created_at asc
  limit 1
  for update;
  if wid is null then raise exception 'No wallet found'; end if;

  perform public.account_bucket_move(wid, 'trading', asset_u, -margin_n);

  size_n := round(margin_n * lev, 8);
  -- Isolated approx: long liq ≈ entry * (1 - 1/lev), short ≈ entry * (1 + 1/lev)
  if side_l = 'long' then
    liq := round(entry * (1 - (1 / lev)), 8);
  else
    liq := round(entry * (1 + (1 / lev)), 8);
  end if;
  if liq < 0 then liq := 0; end if;

  insert into public.perp_positions (
    user_id, wallet_id, market, side, leverage, margin_asset, margin,
    entry_price, size_usd, status, liquidation_price, margin_mode, position_mode
  ) values (
    uid, wid, market_u, side_l, lev, asset_u, margin_n,
    entry, size_n, 'open', liq, 'isolated', 'hedge'
  )
  returning * into pos;

  insert into public.transactions (
    wallet_id, type, status, token_symbol, amount, usd_value, counterparty, memo, tx_hash
  ) values (
    wid, 'send'::public.tx_type, 'confirmed'::public.tx_status, asset_u, margin_n, margin_n,
    'Perp ' || initcap(side_l),
    format('perp_open:%s:%s:%sx', market_u, side_l, lev),
    'perp_' || replace(gen_random_uuid()::text, '-', '')
  );

  return pos;
end;
$$;

grant execute on function public.perp_open_position(text, text, numeric, text, numeric, numeric)
  to authenticated;

create or replace function public.perp_record_funding(
  _position_id uuid,
  _funding_rate numeric,
  _payment numeric,
  _mark_price numeric default null
)
returns public.perp_funding_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pos public.perp_positions;
  pay_n numeric := round(_payment::numeric, 8);
  rate_n numeric := _funding_rate::numeric;
  pay_row public.perp_funding_payments;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into pos
  from public.perp_positions
  where id = _position_id and user_id = uid and status = 'open'
  for update;
  if not found then raise exception 'Open position not found'; end if;

  if pay_n <> 0 then
    perform public.account_bucket_move(pos.wallet_id, 'trading', pos.margin_asset, -pay_n);
  end if;

  insert into public.perp_funding_payments (
    user_id, wallet_id, position_id, market, funding_rate, payment, mark_price
  ) values (
    uid, pos.wallet_id, pos.id, pos.market, rate_n, pay_n, _mark_price
  )
  returning * into pay_row;

  return pay_row;
end;
$$;

grant execute on function public.perp_record_funding(uuid, numeric, numeric, numeric)
  to authenticated;

create or replace view public.v_perp_open_positions
with (security_invoker = true)
as
select *
from public.perp_positions
where status = 'open';

grant select on public.v_perp_open_positions to authenticated;

comment on table public.spot_orders is 'CEX Spot resting/market orders (custodial mark fill).';
comment on table public.spot_fills is 'Spot trade fills / execution history.';
comment on table public.trade_favorites is 'User starred Trade markets (BTC/ETH/SOL/PI).';
comment on table public.perp_funding_payments is 'Perp funding payments ledger (Phase 2).';
comment on function public.spot_place_limit_order is 'Place Spot limit order.';
comment on function public.spot_cancel_order is 'Cancel open Spot order.';
comment on function public.spot_complete_fill is 'Record fill after Funding settlement and close/partial order.';
comment on function public.perp_record_funding is 'Apply and record a funding payment for an open perp.';
