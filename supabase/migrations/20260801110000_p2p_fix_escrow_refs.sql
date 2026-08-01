-- Fix P2P escrow RPCs: replace pgcrypto gen_random_bytes with gen_random_uuid
-- (search_path = public hides extensions.gen_random_bytes on Supabase).
-- Also record wallet activity on lock/release/refund and schedule expiry.
--
-- Apply via: Lovable sync / `supabase db push` / SQL editor /
--   POST /api/admin/p2p-fix  (header x-webhook-secret) after deploy /
--   node scripts/apply-p2p-fix.mjs with SUPABASE_SERVICE_ROLE_KEY

create or replace function public.p2p_ref_hex(_prefix text)
returns text
language sql
volatile
set search_path = public
as $$
  select _prefix || replace(gen_random_uuid()::text, '-', '');
$$;

create or replace function public.p2p_wallet_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.wallets
  where user_id = _user_id
  order by is_active desc, created_at asc
  limit 1;
$$;

create or replace function public.p2p_record_tx(
  _user_id uuid,
  _type public.tx_type,
  _asset text,
  _amount numeric,
  _usd_value numeric,
  _tx_hash text,
  _memo text,
  _counterparty text default 'P2P Escrow'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wid uuid;
begin
  wid := public.p2p_wallet_id(_user_id);
  if wid is null then
    return;
  end if;
  insert into public.transactions (
    wallet_id, type, status, token_symbol, amount, usd_value, counterparty, memo, tx_hash
  ) values (
    wid, _type, 'confirmed', upper(_asset), _amount, coalesce(_usd_value, 0),
    _counterparty, _memo, _tx_hash
  );
end;
$$;

revoke all on function public.p2p_record_tx(uuid, public.tx_type, text, numeric, numeric, text, text, text)
  from public, anon, authenticated;

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
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into ad from public.p2p_ads where id = _ad_id for update;
  if ad is null then raise exception 'Advertisement not found'; end if;
  if ad.status <> 'active' then raise exception 'Advertisement is not active'; end if;
  if ad.user_id = uid then raise exception 'You cannot trade with your own advertisement'; end if;
  if _amount <= 0 or _amount > ad.available_amount then raise exception 'Amount exceeds available'; end if;
  if _amount < ad.min_order or _amount > ad.max_order then raise exception 'Amount outside order limits'; end if;
  if not (_payment_method = any(ad.payment_methods)) then raise exception 'Payment method not accepted'; end if;

  escrow_ref := public.p2p_ref_hex('escrow_');

  insert into public.p2p_orders (
    ad_id, buyer_id, seller_id, asset, amount, price_usd, total_fiat,
    payment_method, status, escrow_status, escrow_tx_hash, expires_at
  )
  values (
    ad.id,
    case when ad.side = 'sell' then uid else ad.user_id end,
    case when ad.side = 'sell' then ad.user_id else uid end,
    ad.asset, _amount, ad.price_usd, round(_amount * ad.price_usd, 2),
    _payment_method, 'pending_payment', 'locked',
    escrow_ref,
    now() + make_interval(mins => ad.pay_time_limit_minutes)
  )
  returning * into o;

  -- Lock seller funds (fails if insufficient — prevents oversell across ads)
  perform public.p2p_move_balance(o.seller_id, o.asset, -_amount);
  update public.p2p_ads set available_amount = available_amount - _amount where id = ad.id;

  perform public.p2p_record_tx(
    o.seller_id, 'sell', o.asset, _amount, o.total_fiat, escrow_ref,
    format('P2P escrow lock %s %s (order %s)', _amount, o.asset, o.ref)
  );

  insert into public.p2p_messages (order_id, is_system, body)
  values (o.id, true, format('Escrow locked: %s %s held until the trade completes.', _amount, o.asset));
  return o;
end;
$$;
grant execute on function public.p2p_open_order(uuid, numeric, text) to authenticated;

create or replace function public.p2p_confirm_received(_order_id uuid)
returns public.p2p_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.p2p_orders;
  uid uuid := auth.uid();
  release_ref text;
begin
  select * into o from public.p2p_orders where id = _order_id for update;
  if o is null then raise exception 'Order not found'; end if;
  if o.seller_id <> uid then raise exception 'Only the seller can confirm payment'; end if;
  if o.status <> 'paid' then raise exception 'Buyer has not marked the payment as sent'; end if;
  if o.escrow_status <> 'locked' then raise exception 'Escrow is not locked'; end if;

  release_ref := public.p2p_ref_hex('release_');
  perform public.p2p_move_balance(o.buyer_id, o.asset, o.amount);
  update public.p2p_orders set
    status = 'completed', escrow_status = 'released',
    released_at = now(), release_tx_hash = release_ref
  where id = _order_id
  returning * into o;

  perform public.p2p_record_tx(
    o.buyer_id, 'receive', o.asset, o.amount, o.total_fiat, release_ref,
    format('P2P escrow release %s %s (order %s)', o.amount, o.asset, o.ref)
  );

  insert into public.p2p_messages (order_id, is_system, body)
  values (o.id, true, format('Escrow released: %s %s sent to the buyer. Trade completed.', o.amount, o.asset));
  return o;
end;
$$;
grant execute on function public.p2p_confirm_received(uuid) to authenticated;

create or replace function public.p2p_cancel_order(_order_id uuid, _reason text default null)
returns public.p2p_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.p2p_orders;
  uid uuid := auth.uid();
  refund_ref text;
begin
  select * into o from public.p2p_orders where id = _order_id for update;
  if o is null then raise exception 'Order not found'; end if;
  if uid not in (o.buyer_id, o.seller_id) and not public.has_role(uid, 'admin') then
    raise exception 'Not allowed';
  end if;
  if o.status not in ('pending_payment', 'paid') then raise exception 'Order can no longer be cancelled'; end if;
  if o.status = 'paid' and uid = o.seller_id and now() < o.expires_at then
    raise exception 'Buyer marked payment sent — open a dispute instead';
  end if;

  refund_ref := public.p2p_ref_hex('refund_');
  perform public.p2p_move_balance(o.seller_id, o.asset, o.amount);
  update public.p2p_ads set available_amount = available_amount + o.amount where id = o.ad_id;
  update public.p2p_orders set
    status = 'cancelled', escrow_status = 'refunded', cancelled_at = now(),
    release_tx_hash = coalesce(release_tx_hash, refund_ref)
  where id = _order_id
  returning * into o;

  perform public.p2p_record_tx(
    o.seller_id, 'receive', o.asset, o.amount, o.total_fiat, refund_ref,
    format('P2P escrow refund %s %s (order %s)', o.amount, o.asset, o.ref)
  );

  insert into public.p2p_messages (order_id, is_system, body)
  values (o.id, true, coalesce('Order cancelled: ' || _reason, 'Order cancelled. Escrow refunded to the seller.'));
  return o;
end;
$$;
grant execute on function public.p2p_cancel_order(uuid, text) to authenticated;

create or replace function public.p2p_resolve_dispute(
  _order_id uuid,
  _release_to_buyer boolean,
  _resolution text
)
returns public.p2p_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.p2p_orders;
  uid uuid := auth.uid();
  release_ref text;
begin
  if not (public.has_role(uid, 'admin') or public.has_role(uid, 'moderator')) then
    raise exception 'Moderator or admin only';
  end if;
  select * into o from public.p2p_orders where id = _order_id for update;
  if o is null then raise exception 'Order not found'; end if;
  if o.status <> 'disputed' then raise exception 'Order is not disputed'; end if;

  if _release_to_buyer then
    release_ref := public.p2p_ref_hex('release_');
    perform public.p2p_move_balance(o.buyer_id, o.asset, o.amount);
    update public.p2p_orders set
      status = 'completed', escrow_status = 'released',
      released_at = now(), release_tx_hash = release_ref
    where id = _order_id
    returning * into o;
    perform public.p2p_record_tx(
      o.buyer_id, 'receive', o.asset, o.amount, o.total_fiat, release_ref,
      format('P2P dispute release to buyer %s %s (order %s)', o.amount, o.asset, o.ref)
    );
  else
    release_ref := public.p2p_ref_hex('refund_');
    perform public.p2p_move_balance(o.seller_id, o.asset, o.amount);
    update public.p2p_ads set available_amount = available_amount + o.amount where id = o.ad_id;
    update public.p2p_orders set
      status = 'cancelled', escrow_status = 'refunded', cancelled_at = now(),
      release_tx_hash = release_ref
    where id = _order_id
    returning * into o;
    perform public.p2p_record_tx(
      o.seller_id, 'receive', o.asset, o.amount, o.total_fiat, release_ref,
      format('P2P dispute refund to seller %s %s (order %s)', o.amount, o.asset, o.ref)
    );
  end if;

  update public.p2p_disputes set
    status = case
      when _release_to_buyer then 'resolved_buyer'::public.p2p_dispute_status
      else 'resolved_seller'::public.p2p_dispute_status
    end,
    moderator_id = uid,
    resolution = _resolution,
    resolved_at = now()
  where order_id = _order_id;

  insert into public.p2p_messages (order_id, is_system, body)
  values (_order_id, true, 'Dispute resolved by moderator: ' || coalesce(_resolution, ''));
  return o;
end;
$$;
grant execute on function public.p2p_resolve_dispute(uuid, boolean, text) to authenticated;

create or replace function public.p2p_expire_orders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.p2p_orders;
  n int := 0;
  refund_ref text;
begin
  for o in
    select * from public.p2p_orders
    where status = 'pending_payment' and expires_at < now()
    for update
  loop
    refund_ref := public.p2p_ref_hex('expire_');
    perform public.p2p_move_balance(o.seller_id, o.asset, o.amount);
    update public.p2p_ads set available_amount = available_amount + o.amount where id = o.ad_id;
    update public.p2p_orders set
      status = 'expired', escrow_status = 'refunded', cancelled_at = now(),
      release_tx_hash = coalesce(release_tx_hash, refund_ref)
    where id = o.id;
    perform public.p2p_record_tx(
      o.seller_id, 'receive', o.asset, o.amount, o.total_fiat, refund_ref,
      format('P2P escrow expired refund %s %s (order %s)', o.amount, o.asset, o.ref)
    );
    insert into public.p2p_messages (order_id, is_system, body)
    values (o.id, true, 'Payment window expired. Escrow refunded to the seller.');
    n := n + 1;
  end loop;
  return n;
end;
$$;
grant execute on function public.p2p_expire_orders() to authenticated;

-- Create sell ads only when the seller has enough free balance
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

  if _side = 'sell' then
    col := public.p2p_balance_column(_asset);
    execute format(
      'select coalesce(%I, 0) from public.wallets where user_id = $1 order by is_active desc, created_at asc limit 1',
      col
    ) into bal using uid;
    if bal is null then raise exception 'No wallet found'; end if;

    select coalesce(sum(available_amount), 0) into reserved
    from public.p2p_ads
    where user_id = uid and side = 'sell' and status = 'active' and upper(asset) = upper(_asset);

    if bal - reserved < _total_amount then
      raise exception
        'Insufficient % balance. Available for new ads: % (wallet % minus reserved %)',
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

-- Expire stale payment windows every minute (pg_cron already used in this project)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'p2p-expire-orders';
    perform cron.schedule(
      'p2p-expire-orders',
      '* * * * *',
      $cron$ select public.p2p_expire_orders(); $cron$
    );
  end if;
exception when others then
  -- cron may live in a different schema / lack privileges in some environments
  raise notice 'p2p expire cron not scheduled: %', sqlerrm;
end;
$$;
