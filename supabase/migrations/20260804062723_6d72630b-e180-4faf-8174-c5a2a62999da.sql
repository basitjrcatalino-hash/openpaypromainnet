alter table public.spot_orders
  add column if not exists trigger_price numeric,
  add column if not exists trigger_direction text,
  add column if not exists post_only boolean not null default false,
  add column if not exists oco_group uuid,
  add column if not exists trail_percent numeric,
  add column if not exists trail_ref numeric,
  add column if not exists triggered_at timestamptz;

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.spot_orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%order_type%'
  loop
    execute format('alter table public.spot_orders drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.spot_orders
  add constraint spot_orders_order_type_chk
  check (order_type in ('market','limit','stop_limit','stop_market','trailing_stop'));

alter table public.perp_positions
  add column if not exists take_profit_price numeric,
  add column if not exists stop_loss_price numeric;

create or replace function public.spot_place_trigger_order(
  _market text,
  _side text,
  _order_type text,
  _amount numeric,
  _pay_asset text,
  _trigger_price numeric default null,
  _trigger_direction text default null,
  _price numeric default null,
  _trail_percent numeric default null,
  _trail_ref numeric default null,
  _post_only boolean default false,
  _reduce_only boolean default false,
  _time_in_force text default 'gtc',
  _oco_group uuid default null
)
returns public.spot_orders
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  wid uuid;
  market_u text := upper(trim(_market));
  side_l text := lower(trim(_side));
  kind text := lower(trim(_order_type));
  asset_u text := upper(trim(_pay_asset));
  dir text := lower(coalesce(nullif(trim(_trigger_direction), ''), case when side_l = 'buy' then 'above' else 'below' end));
  row public.spot_orders;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if market_u not in ('BTC','ETH','SOL','PI') then raise exception 'Unsupported market'; end if;
  if side_l not in ('buy','sell') then raise exception 'Side must be buy or sell'; end if;
  if kind not in ('stop_limit','stop_market','trailing_stop') then
    raise exception 'Unsupported trigger order type %', kind;
  end if;
  if asset_u not in ('USDT','OUSD','USDC') then raise exception 'Unsupported pay asset'; end if;
  if _amount is null or _amount <= 0 then raise exception 'Amount must be positive'; end if;
  if dir not in ('above','below') then raise exception 'Trigger direction must be above or below'; end if;
  if kind = 'trailing_stop' then
    if _trail_percent is null or _trail_percent <= 0 or _trail_percent > 50 then
      raise exception 'Trail percent must be between 0 and 50';
    end if;
  else
    if _trigger_price is null or _trigger_price <= 0 then raise exception 'Trigger price required'; end if;
  end if;
  if kind = 'stop_limit' and (_price is null or _price <= 0) then
    raise exception 'Limit price required for stop-limit';
  end if;

  select id into wid
  from public.wallets
  where user_id = uid
  order by is_active desc, created_at asc
  limit 1;
  if wid is null then raise exception 'No wallet found'; end if;

  insert into public.spot_orders (
    user_id, wallet_id, market, side, order_type, price, amount, filled,
    pay_asset, status, reduce_only, time_in_force, post_only,
    trigger_price, trigger_direction, trail_percent, trail_ref, oco_group
  ) values (
    uid, wid, market_u, side_l, kind, coalesce(_price, 0), round(_amount, 8), 0,
    asset_u, 'open', coalesce(_reduce_only, false), lower(coalesce(_time_in_force, 'gtc')),
    coalesce(_post_only, false),
    case when kind = 'trailing_stop' then null else round(_trigger_price, 8) end,
    dir,
    case when kind = 'trailing_stop' then _trail_percent else null end,
    case when kind = 'trailing_stop' then _trail_ref else null end,
    _oco_group
  )
  returning * into row;

  return row;
end;
$function$;

create or replace function public.perp_set_tpsl(
  _position_id uuid,
  _take_profit numeric default null,
  _stop_loss numeric default null
)
returns public.perp_positions
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  pos public.perp_positions;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into pos from public.perp_positions
  where id = _position_id and user_id = uid
  for update;
  if pos.id is null then raise exception 'Position not found'; end if;
  if pos.status <> 'open' then raise exception 'Position is not open'; end if;

  update public.perp_positions
  set take_profit_price = case when _take_profit is null or _take_profit <= 0 then null else round(_take_profit, 8) end,
      stop_loss_price = case when _stop_loss is null or _stop_loss <= 0 then null else round(_stop_loss, 8) end,
      updated_at = now()
  where id = _position_id
  returning * into pos;

  return pos;
end;
$function$;

create or replace function public.perp_add_margin(
  _position_id uuid,
  _amount numeric
)
returns public.perp_positions
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  pos public.perp_positions;
  add_n numeric := round(coalesce(_amount, 0), 8);
  new_margin numeric;
  new_lev numeric;
  liq numeric;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if add_n <= 0 then raise exception 'Amount must be positive'; end if;

  select * into pos from public.perp_positions
  where id = _position_id and user_id = uid
  for update;
  if pos.id is null then raise exception 'Position not found'; end if;
  if pos.status <> 'open' then raise exception 'Position is not open'; end if;

  perform public.account_bucket_move(pos.wallet_id, 'trading', pos.margin_asset, -add_n);

  new_margin := round(pos.margin + add_n, 8);
  new_lev := case when new_margin > 0 then round(pos.size_usd / new_margin, 4) else pos.leverage end;
  if new_lev < 1 then new_lev := 1; end if;

  if pos.side = 'long' then
    liq := round(pos.entry_price * (1 - (1 / new_lev)), 8);
  else
    liq := round(pos.entry_price * (1 + (1 / new_lev)), 8);
  end if;
  if liq < 0 then liq := 0; end if;

  update public.perp_positions
  set margin = new_margin,
      leverage = new_lev,
      liquidation_price = liq,
      updated_at = now()
  where id = _position_id
  returning * into pos;

  insert into public.transactions (
    wallet_id, type, status, token_symbol, amount, usd_value, counterparty, memo, tx_hash
  ) values (
    pos.wallet_id, 'send'::public.tx_type, 'confirmed'::public.tx_status, pos.margin_asset,
    add_n, add_n, 'Perp margin',
    format('perp_add_margin:%s:%s', pos.market, pos.side),
    'perpmargin_' || replace(gen_random_uuid()::text, '-', '')
  );

  return pos;
end;
$function$;

revoke all on function public.spot_place_trigger_order(text, text, text, numeric, text, numeric, text, numeric, numeric, numeric, boolean, boolean, text, uuid) from public, anon;
revoke all on function public.perp_set_tpsl(uuid, numeric, numeric) from public, anon;
revoke all on function public.perp_add_margin(uuid, numeric) from public, anon;

grant execute on function public.spot_place_trigger_order(text, text, text, numeric, text, numeric, text, numeric, numeric, numeric, boolean, boolean, text, uuid) to authenticated;
grant execute on function public.perp_set_tpsl(uuid, numeric, numeric) to authenticated;
grant execute on function public.perp_add_margin(uuid, numeric) to authenticated;