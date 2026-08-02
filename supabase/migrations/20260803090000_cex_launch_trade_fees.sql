-- Launch CEX fee schedule for Spot / Perpetual:
-- Spot maker/taker 10 bps (0.10%) — applied in app (buy-major / OpenDEX).
-- Perp maker 2 bps (0.02%) · Perp taker 5 bps (0.05%).
-- Market open/close uses taker (5 bps).

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
  fee_bps numeric := 5; -- PERP_TAKER_FEE_BPS (market open)
  fee_n numeric;
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

  size_n := round(margin_n * lev, 8);
  fee_n := round(size_n * fee_bps / 10000.0, 8);

  perform public.account_bucket_move(wid, 'trading', asset_u, -(margin_n + fee_n));

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
    format('perp_open:%s:%s:%sx:fee=%s', market_u, side_l, lev, fee_n),
    'perp_' || replace(gen_random_uuid()::text, '-', '')
  );

  if fee_n > 0 then
    insert into public.transactions (
      wallet_id, type, status, token_symbol, amount, usd_value, counterparty, memo, tx_hash
    ) values (
      wid, 'send'::public.tx_type, 'confirmed'::public.tx_status, asset_u, fee_n, fee_n,
      'Platform fee',
      format('perp_fee_open:%s:%s:%sbps', market_u, side_l, fee_bps),
      'perp_fee_' || replace(gen_random_uuid()::text, '-', '')
    );
    perform public.credit_platform_fee_asset(
      fee_n,
      asset_u,
      format('Perp open fee · %s %s %sx', market_u, side_l, lev),
      wid,
      'perp_fee'
    );
  end if;

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
  gross_credit numeric;
  fee_bps numeric := 5; -- PERP_TAKER_FEE_BPS (market close)
  fee_n numeric;
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

  if pnl < -pos.margin then pnl := -pos.margin; end if;

  gross_credit := round(pos.margin + pnl, 8);
  fee_n := round(pos.size_usd * fee_bps / 10000.0, 8);
  if fee_n > greatest(gross_credit, 0) then
    fee_n := greatest(gross_credit, 0);
  end if;
  credit := round(gross_credit - fee_n, 8);

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
    (case when credit >= pos.margin then 'receive' else 'send' end)::public.tx_type,
    'confirmed'::public.tx_status,
    pos.margin_asset,
    abs(pnl),
    abs(pnl),
    'Perp close',
    format('perp_close:%s:%s:pnl=%s:fee=%s', pos.market, pos.side, pnl, fee_n),
    'perp_' || replace(gen_random_uuid()::text, '-', '')
  );

  if fee_n > 0 then
    insert into public.transactions (
      wallet_id, type, status, token_symbol, amount, usd_value, counterparty, memo, tx_hash
    ) values (
      pos.wallet_id,
      'send'::public.tx_type,
      'confirmed'::public.tx_status,
      pos.margin_asset,
      fee_n,
      fee_n,
      'Platform fee',
      format('perp_fee_close:%s:%s:%sbps', pos.market, pos.side, fee_bps),
      'perp_fee_' || replace(gen_random_uuid()::text, '-', '')
    );
    perform public.credit_platform_fee_asset(
      fee_n,
      pos.margin_asset,
      format('Perp close fee · %s %s', pos.market, pos.side),
      pos.wallet_id,
      'perp_fee'
    );
  end if;

  return pos;
end;
$$;

grant execute on function public.perp_close_position(uuid, numeric)
  to authenticated;

comment on function public.perp_open_position is
  'Open perp; charges 5 bps taker fee on notional (margin×leverage). Maker schedule is 2 bps.';
comment on function public.perp_close_position is
  'Close perp; charges 5 bps taker fee on notional from returned equity.';
