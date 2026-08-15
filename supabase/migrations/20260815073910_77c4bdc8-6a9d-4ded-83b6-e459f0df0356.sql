CREATE OR REPLACE FUNCTION public.perp_open_position(
  _market text,
  _side text,
  _leverage numeric,
  _margin_asset text,
  _margin numeric,
  _entry_price numeric
)
RETURNS public.perp_positions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  fee_bps numeric := 5;
  fee_n numeric;
  liq numeric;
  pos public.perp_positions;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not public.is_trade_market_symbol(market_u) then raise exception 'Unsupported market'; end if;
  if side_l not in ('long','short') then raise exception 'Invalid side'; end if;
  if asset_u not in ('USDT','OUSD','USDC') then raise exception 'Unsupported margin asset'; end if;
  if lev is null or lev <= 0 or lev > 125 then raise exception 'Invalid leverage'; end if;
  if margin_n is null or margin_n <= 0 then raise exception 'Invalid margin'; end if;
  if entry is null or entry <= 0 then raise exception 'Invalid entry price'; end if;

  wid := public.p2p_wallet_id(uid);
  if wid is null then raise exception 'No wallet'; end if;

  size_n := round(margin_n * lev, 8);
  fee_n := round(size_n * fee_bps / 10000.0, 8);

  -- debit margin + opening fee from the Trading account
  perform public.account_bucket_move(wid, 'trading', asset_u, -(margin_n + fee_n));

  if side_l = 'long' then
    liq := round(entry * (1 - 1 / lev), 8);
  else
    liq := round(entry * (1 + 1 / lev), 8);
  end if;

  insert into public.perp_positions (
    user_id, wallet_id, market, side, leverage, margin_asset, margin,
    entry_price, size_usd, status, liquidation_price
  ) values (
    uid, wid, market_u, side_l, lev, asset_u, margin_n,
    entry, size_n, 'open', liq
  )
  returning * into pos;

  insert into public.transactions (
    wallet_id, type, status, token_symbol, amount, usd_value, counterparty, memo, tx_hash
  ) values (
    wid, 'send'::public.tx_type, 'confirmed'::public.tx_status, asset_u,
    margin_n, margin_n, 'Perp open',
    format('perp_open:%s:%s:lev=%s', market_u, side_l, lev),
    'perp_' || replace(gen_random_uuid()::text, '-', '')
  );

  if fee_n > 0 then
    insert into public.transactions (
      wallet_id, type, status, token_symbol, amount, usd_value, counterparty, memo, tx_hash
    ) values (
      wid, 'send'::public.tx_type, 'confirmed'::public.tx_status, asset_u,
      fee_n, fee_n, 'Platform fee',
      format('perp_fee_open:%s:%s:%sbps', market_u, side_l, fee_bps),
      'perp_fee_' || replace(gen_random_uuid()::text, '-', '')
    );
    perform public.credit_platform_fee_asset(
      fee_n, asset_u,
      format('Perp open fee · %s %s', market_u, side_l),
      wid, 'perp_fee'
    );
  end if;

  return pos;
end;
$$;

REVOKE ALL ON FUNCTION public.perp_open_position(text, text, numeric, text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perp_open_position(text, text, numeric, text, numeric, numeric) TO authenticated;