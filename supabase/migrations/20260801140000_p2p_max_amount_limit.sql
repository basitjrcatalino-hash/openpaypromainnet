-- Cap P2P ads and orders at 5000 OUSD (stables by units; other assets by $5000 notional).

create or replace function public.p2p_max_ousd()
returns numeric
language sql
immutable
as $$
  select 5000::numeric;
$$;

create or replace function public.p2p_assert_trade_limit(
  _asset text,
  _amount numeric,
  _price_usd numeric,
  _label text default 'amount'
)
returns void
language plpgsql
immutable
set search_path = public
as $$
declare
  lim numeric := public.p2p_max_ousd();
  a text := upper(trim(_asset));
  notional numeric;
begin
  if _amount is null or _amount <= 0 then
    raise exception 'Invalid %', _label;
  end if;
  if _price_usd is null or _price_usd <= 0 then
    raise exception 'Invalid price';
  end if;

  if a in ('OUSD', 'USDT', 'USDC') then
    if _amount > lim then
      raise exception
        'P2P % cannot exceed % OUSD (got % %)',
        _label, lim, _amount, a;
    end if;
  else
    notional := round(_amount * _price_usd, 8);
    if notional > lim then
      raise exception
        'P2P % cannot exceed $% notional (~% OUSD). Got $%',
        _label, lim, lim, notional;
    end if;
  end if;
end;
$$;

revoke all on function public.p2p_assert_trade_limit(text, numeric, numeric, text) from public, anon;
grant execute on function public.p2p_assert_trade_limit(text, numeric, numeric, text) to authenticated;
grant execute on function public.p2p_max_ousd() to authenticated, anon;

create or replace function public.p2p_open_order(_ad_id uuid, _amount numeric, _payment_method text)
returns public.p2p_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  ad public.p2p_ads;
  o public.p2p_orders;
  uid uuid := auth.uid();
  escrow_ref text;
  seller uuid;
  buyer uuid;
  acc public.p2p_payment_accounts;
  snap jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into ad from public.p2p_ads where id = _ad_id for update;
  if ad is null then raise exception 'Advertisement not found'; end if;
  if ad.status <> 'active' then raise exception 'Advertisement is not active'; end if;
  if ad.user_id = uid then raise exception 'You cannot trade with your own advertisement'; end if;
  if _amount <= 0 or _amount > ad.available_amount then raise exception 'Amount exceeds available'; end if;
  if _amount < ad.min_order or _amount > ad.max_order then raise exception 'Amount outside order limits'; end if;
  if not (_payment_method = any(ad.payment_methods)) then raise exception 'Payment method not accepted'; end if;

  perform public.p2p_assert_trade_limit(ad.asset, _amount, ad.price_usd, 'order');

  buyer := case when ad.side = 'sell' then uid else ad.user_id end;
  seller := case when ad.side = 'sell' then ad.user_id else uid end;

  acc := public.p2p_pick_payment_account(seller, _payment_method);
  if acc is null or acc.id is null then
    raise exception
      'Seller has no active % receive account. Ask them to fund/set up their merchant wallet first.',
      _payment_method;
  end if;

  snap := jsonb_build_object(
    'account_id', acc.id,
    'method_code', acc.method_code,
    'account_name', acc.account_name,
    'account_number', acc.account_number,
    'bank_name', acc.bank_name,
    'extra', coalesce(acc.extra, '{}'::jsonb)
  );

  escrow_ref := public.p2p_ref_hex('escrow_');

  insert into public.p2p_orders (
    ad_id, buyer_id, seller_id, asset, amount, price_usd, total_fiat,
    payment_method, payment_account_id, payment_account_snapshot,
    status, escrow_status, escrow_tx_hash, expires_at
  )
  values (
    ad.id, buyer, seller,
    ad.asset, _amount, ad.price_usd, round(_amount * ad.price_usd, 2),
    _payment_method, acc.id, snap,
    'pending_payment', 'locked',
    escrow_ref,
    now() + make_interval(mins => ad.pay_time_limit_minutes)
  )
  returning * into o;

  perform public.p2p_move_balance(o.seller_id, o.asset, -_amount);
  update public.p2p_ads set available_amount = available_amount - _amount where id = ad.id;

  perform public.p2p_record_tx(
    o.seller_id, 'sell', o.asset, _amount, o.total_fiat, escrow_ref,
    format('P2P escrow lock %s %s (order %s)', _amount, o.asset, o.ref)
  );

  insert into public.p2p_messages (order_id, is_system, body)
  values (
    o.id,
    true,
    format(
      'Escrow locked: %s %s held until the trade completes. Pay %s to %s (%s).',
      _amount,
      o.asset,
      acc.account_name,
      acc.account_number,
      _payment_method
    )
  );
  return o;
end;
$$;

grant execute on function public.p2p_open_order(uuid, numeric, text) to authenticated;

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
  col text;
  bal numeric;
  reserved numeric;
  ad public.p2p_ads;
  missing text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if _price_usd <= 0 or _total_amount <= 0 then raise exception 'Invalid amount'; end if;
  if _min_order <= 0 or _max_order < _min_order then raise exception 'Invalid order limits'; end if;
  if _max_order > _total_amount then raise exception 'Max order cannot exceed total amount'; end if;
  if coalesce(array_length(_payment_methods, 1), 0) = 0 then
    raise exception 'Select at least one payment method';
  end if;
  if public.p2p_balance_column(_asset) is null then
    raise exception 'Unsupported asset %', _asset;
  end if;

  perform public.p2p_assert_trade_limit(_asset, _total_amount, _price_usd, 'ad total');
  perform public.p2p_assert_trade_limit(_asset, _max_order, _price_usd, 'max order');
  perform public.p2p_assert_trade_limit(_asset, _min_order, _price_usd, 'min order');

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

    col := public.p2p_balance_column(_asset);
    execute format(
      'select coalesce(%I, 0) from public.wallets where user_id = $1 order by is_active desc, created_at asc limit 1',
      col
    ) into bal using uid;
    if bal is null then raise exception 'No wallet found — fund your merchant wallet first'; end if;

    select coalesce(sum(available_amount), 0) into reserved
    from public.p2p_ads
    where user_id = uid and side = 'sell' and status = 'active' and upper(asset) = upper(_asset);

    if bal - reserved < _total_amount then
      raise exception
        'Insufficient % balance. Fund your merchant wallet first. Available for new ads: % (wallet % − reserved %).',
        upper(_asset),
        greatest(bal - reserved, 0),
        bal,
        reserved;
    end if;
  end if;

  insert into public.p2p_ads (
    user_id, side, asset, price_usd, total_amount, available_amount,
    min_order, max_order, payment_methods, pay_time_limit_minutes, terms
  ) values (
    uid, _side, upper(_asset), _price_usd, _total_amount, _total_amount,
    _min_order, _max_order, _payment_methods, _pay_time_limit_minutes, nullif(trim(_terms), '')
  )
  returning * into ad;
  return ad;
end;
$$;

grant execute on function public.p2p_create_ad(
  public.p2p_ad_side, text, numeric, numeric, numeric, numeric, text[], int, text
) to authenticated;
