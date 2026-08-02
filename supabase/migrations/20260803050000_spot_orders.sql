-- Spot limit orders (custodial resting orders filled against live mark).
-- Markets: BTC, ETH, SOL, PI. Pay assets for buys: USDT / OUSD / USDC.

create table if not exists public.spot_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  market text not null check (market in ('BTC', 'ETH', 'SOL', 'PI')),
  side text not null check (side in ('buy', 'sell')),
  order_type text not null default 'limit' check (order_type in ('market', 'limit')),
  price numeric(38, 8) not null check (price > 0),
  amount numeric(38, 8) not null check (amount > 0),
  filled numeric(38, 8) not null default 0 check (filled >= 0),
  pay_asset text not null check (pay_asset in ('USDT', 'OUSD', 'USDC')),
  status text not null default 'open'
    check (status in ('open', 'partial', 'filled', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  filled_at timestamptz
);

create index if not exists spot_orders_user_status_idx
  on public.spot_orders (user_id, status, created_at desc);

create index if not exists spot_orders_open_market_idx
  on public.spot_orders (market, status)
  where status in ('open', 'partial');

alter table public.spot_orders enable row level security;

drop policy if exists "spot_orders_owner_select" on public.spot_orders;
create policy "spot_orders_owner_select" on public.spot_orders
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "spot_orders_owner_insert" on public.spot_orders;
create policy "spot_orders_owner_insert" on public.spot_orders
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "spot_orders_owner_update" on public.spot_orders;
create policy "spot_orders_owner_update" on public.spot_orders
  for update to authenticated
  using (user_id = auth.uid());

grant select, insert, update on public.spot_orders to authenticated;
grant all on public.spot_orders to service_role;
