-- Perpetual positions funded from Trading account (wallet_account_balances).
-- Markets: non-stable majors only (BTC, ETH, SOL, PI). Margin: USDT / OUSD / USDC.

create table if not exists public.perp_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  market text not null check (market in ('BTC', 'ETH', 'SOL', 'PI')),
  side text not null check (side in ('long', 'short')),
  leverage numeric(8, 2) not null check (leverage >= 1 and leverage <= 20),
  margin_asset text not null check (margin_asset in ('USDT', 'OUSD', 'USDC')),
  margin numeric(38, 8) not null check (margin > 0),
  entry_price numeric(38, 8) not null check (entry_price > 0),
  size_usd numeric(38, 8) not null check (size_usd > 0),
  status text not null default 'open' check (status in ('open', 'closed', 'liquidated')),
  exit_price numeric(38, 8),
  realized_pnl numeric(38, 8),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists perp_positions_user_open_idx
  on public.perp_positions (user_id, status, created_at desc);

create index if not exists perp_positions_wallet_idx
  on public.perp_positions (wallet_id, status);

alter table public.perp_positions enable row level security;

drop policy if exists "perp_owner_select" on public.perp_positions;
create policy "perp_owner_select" on public.perp_positions
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.perp_positions to authenticated;
grant all on public.perp_positions to service_role;

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

  -- Debit Trading account
  perform public.account_bucket_move(wid, 'trading', asset_u, -margin_n);

  size_n := round(margin_n * lev, 8);

  insert into public.perp_positions (
    user_id, wallet_id, market, side, leverage, margin_asset, margin,
    entry_price, size_usd, status
  ) values (
    uid, wid, market_u, side_l, lev, asset_u, margin_n,
    entry, size_n, 'open'
  )
  returning * into pos;

  insert into public.transactions (
    wallet_id, type, status, token_symbol, amount, usd_value, counterparty, memo, tx_hash
  ) values (
    wid, 'send', 'confirmed', asset_u, margin_n, margin_n,
    'Perp ' || initcap(side_l),
    format('perp_open:%s:%s:%sx', market_u, side_l, lev),
    'perp_' || replace(gen_random_uuid()::text, '-', '')
  );

  return pos;
end;
$$;

grant execute on function public.perp_open_position(text, text, numeric, text, numeric, numeric)
  to authenticated;

create or replace function public.perp_close_position(
  _position_id uuid,
  _exit_price numeric
)
returns public.perp_positions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pos public.perp_positions;
  exit_px numeric := _exit_price::numeric;
  pnl numeric;
  credit numeric;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if exit_px is null or exit_px <= 0 then raise exception 'Invalid exit price'; end if;

  select * into pos
  from public.perp_positions
  where id = _position_id and user_id = uid
  for update;
  if not found then raise exception 'Position not found'; end if;
  if pos.status <> 'open' then raise exception 'Position is already closed'; end if;

  if pos.side = 'long' then
    pnl := round(pos.size_usd * ((exit_px - pos.entry_price) / pos.entry_price), 8);
  else
    pnl := round(pos.size_usd * ((pos.entry_price - exit_px) / pos.entry_price), 8);
  end if;

  -- Isolated margin: loss capped at margin
  if pnl < -pos.margin then pnl := -pos.margin; end if;

  credit := round(pos.margin + pnl, 8);
  if credit > 0 then
    perform public.account_bucket_move(pos.wallet_id, 'trading', pos.margin_asset, credit);
  end if;

  update public.perp_positions
  set status = case when pnl <= -pos.margin then 'liquidated' else 'closed' end,
      exit_price = exit_px,
      realized_pnl = pnl,
      closed_at = now(),
      updated_at = now()
  where id = pos.id
  returning * into pos;

  insert into public.transactions (
    wallet_id, type, status, token_symbol, amount, usd_value, counterparty, memo, tx_hash
  ) values (
    pos.wallet_id,
    case when credit >= pos.margin then 'receive' else 'send' end,
    'confirmed',
    pos.margin_asset,
    abs(pnl),
    abs(pnl),
    'Perp close',
    format('perp_close:%s:%s:pnl=%s', pos.market, pos.side, pnl),
    'perp_' || replace(gen_random_uuid()::text, '-', '')
  );

  return pos;
end;
$$;

grant execute on function public.perp_close_position(uuid, numeric)
  to authenticated;
