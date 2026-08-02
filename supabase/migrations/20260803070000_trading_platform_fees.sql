-- Platform trading fees for Spot (already in buyMajor/OpenDEX) + Perpetuals.
-- Matches exchange-style 30 bps (0.30%) on notional / trade value.

-- ---------------------------------------------------------------------------
-- Credit USDT / USDC / OUSD platform fees to treasury wallet ledger columns
-- ---------------------------------------------------------------------------
create or replace function public.credit_platform_fee_asset(
  p_amount numeric,
  p_asset text,
  p_memo text default 'Platform fee',
  p_source_wallet_id uuid default null,
  p_counterparty text default 'platform_fee'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  treasury_id uuid;
  fee_amt numeric := round(coalesce(p_amount, 0), 8);
  asset_u text := upper(trim(p_asset));
  configured text;
  handle text;
begin
  if fee_amt <= 0 then
    return null;
  end if;

  if asset_u not in ('OUSD', 'USDT', 'USDC') then
    raise exception 'Unsupported fee asset %', asset_u;
  end if;

  -- OUSD path reuses existing helper (admin fee wallet resolution)
  if asset_u = 'OUSD' then
    return public.credit_platform_fee_ousd(
      fee_amt,
      p_memo,
      p_source_wallet_id,
      coalesce(p_counterparty, 'platform_fee')
    );
  end if;

  -- Resolve treasury (same order as credit_platform_fee_ousd)
  select nullif(trim(fee_wallet_address), '') into configured
  from public.topup_settings
  where id = 1;

  if configured is not null then
    if lower(configured) like '0x%' then
      select w.id into treasury_id
      from public.wallets w
      where lower(w.address) = lower(configured)
      limit 1;
    else
      handle := lower(ltrim(configured, '@'));
      select w.id into treasury_id
      from public.wallets w
      join public.profiles p on p.id = w.user_id
      where lower(p.username) = handle
      order by w.is_active desc nulls last, w.created_at asc
      limit 1;
    end if;
  end if;

  if treasury_id is null then
    select w.id into treasury_id
    from public.wallets w
    where lower(w.address) = lower('0xc847682465ea537c3957cd46eff2c7229faefde1')
    limit 1;
  end if;

  if treasury_id is null then
    select w.id into treasury_id
    from public.wallets w
    join public.profiles p on p.id = w.user_id
    where lower(p.username) = lower('openpay')
    order by w.is_active desc nulls last, w.created_at asc
    limit 1;
  end if;

  if treasury_id is null then
    raise warning 'Platform fee treasury missing; % % not credited', fee_amt, asset_u;
    return null;
  end if;

  if asset_u = 'USDT' then
    update public.wallets
    set usdt_balance = coalesce(usdt_balance, 0) + fee_amt
    where id = treasury_id;
  else
    update public.wallets
    set usdc_balance = coalesce(usdc_balance, 0) + fee_amt
    where id = treasury_id;
  end if;

  insert into public.transactions (
    wallet_id, type, status, token_symbol, counterparty, amount, usd_value, memo
  ) values (
    treasury_id,
    'receive'::public.tx_type,
    'confirmed'::public.tx_status,
    asset_u,
    coalesce(p_counterparty, coalesce(p_source_wallet_id::text, 'platform_fee')),
    fee_amt,
    fee_amt,
    p_memo
  );

  return treasury_id;
end;
$$;

revoke all on function public.credit_platform_fee_asset(numeric, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.credit_platform_fee_asset(numeric, text, text, uuid, text)
  to service_role;

-- Keep callable from other security-definer RPCs (same role as owner)
grant execute on function public.credit_platform_fee_asset(numeric, text, text, uuid, text)
  to postgres;

-- ---------------------------------------------------------------------------
-- Perp open: 0.30% fee on notional (margin × leverage)
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
  fee_bps numeric := 30; -- PLATFORM_TRADE_FEE_BPS
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

  -- Debit margin + platform fee from Trading account
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

-- ---------------------------------------------------------------------------
-- Perp close: 0.30% fee on notional, deducted from returned margin+PnL
-- ---------------------------------------------------------------------------
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
  fee_bps numeric := 30;
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

  -- Isolated margin: loss capped at margin
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

comment on function public.credit_platform_fee_asset is
  'Credit OUSD/USDT/USDC platform trading fees to treasury wallet.';
comment on function public.perp_open_position is
  'Open perp; charges 30 bps platform fee on notional (margin×leverage).';
comment on function public.perp_close_position is
  'Close perp; charges 30 bps platform fee on notional from returned equity.';
