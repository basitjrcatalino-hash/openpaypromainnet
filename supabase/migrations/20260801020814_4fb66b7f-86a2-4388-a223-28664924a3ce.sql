-- ---------- enums ----------
create type public.p2p_ad_side as enum ('sell','buy');
create type public.p2p_ad_status as enum ('active','paused','closed');
create type public.p2p_order_status as enum ('pending_payment','paid','completed','cancelled','expired','disputed');
create type public.p2p_escrow_status as enum ('none','locked','released','refunded','frozen');
create type public.p2p_dispute_status as enum ('open','resolved_buyer','resolved_seller','cancelled');

-- ---------- payment methods ----------
create table public.p2p_payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  icon text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.p2p_payment_methods to authenticated, anon;
grant all on public.p2p_payment_methods to service_role;
alter table public.p2p_payment_methods enable row level security;
create policy "p2p_pm_read" on public.p2p_payment_methods for select to authenticated, anon using (true);
create policy "p2p_pm_admin_write" on public.p2p_payment_methods for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.p2p_payment_methods (code,name,icon,sort_order) values
 ('bank_transfer','Bank Transfer','🏦',10),
 ('gcash','GCash','💙',20),
 ('maya','Maya','💚',30),
 ('paypal','PayPal','🅿️',40),
 ('wise','Wise','🌍',50),
 ('revolut','Revolut','⚡',60),
 ('openpay','OpenPay Balance','◎',70);

-- ---------- ads ----------
create table public.p2p_ads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  side public.p2p_ad_side not null default 'sell',
  asset text not null default 'OUSD',
  price_usd numeric(38,8) not null check (price_usd > 0),
  total_amount numeric(38,8) not null check (total_amount > 0),
  available_amount numeric(38,8) not null check (available_amount >= 0),
  min_order numeric(38,8) not null default 1 check (min_order > 0),
  max_order numeric(38,8) not null check (max_order > 0),
  payment_methods text[] not null default '{}',
  pay_time_limit_minutes int not null default 15 check (pay_time_limit_minutes between 5 and 120),
  terms text,
  status public.p2p_ad_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index p2p_ads_browse_idx on public.p2p_ads (status, side, asset, price_usd);
create index p2p_ads_user_idx on public.p2p_ads (user_id, created_at desc);
grant select, insert, update, delete on public.p2p_ads to authenticated;
grant all on public.p2p_ads to service_role;
alter table public.p2p_ads enable row level security;
create policy "p2p_ads_read_active" on public.p2p_ads for select to authenticated
  using (status = 'active' or user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "p2p_ads_owner_insert" on public.p2p_ads for insert to authenticated with check (user_id = auth.uid());
create policy "p2p_ads_owner_update" on public.p2p_ads for update to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "p2p_ads_owner_delete" on public.p2p_ads for delete to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- ---------- orders ----------
create table public.p2p_orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('P2P-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  ad_id uuid not null references public.p2p_ads(id) on delete restrict,
  buyer_id uuid not null,
  seller_id uuid not null,
  asset text not null,
  amount numeric(38,8) not null check (amount > 0),
  price_usd numeric(38,8) not null,
  total_fiat numeric(38,2) not null,
  fiat_currency text not null default 'USD',
  payment_method text not null,
  status public.p2p_order_status not null default 'pending_payment',
  escrow_status public.p2p_escrow_status not null default 'none',
  escrow_tx_hash text,
  release_tx_hash text,
  payment_proof_url text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  released_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index p2p_orders_buyer_idx on public.p2p_orders (buyer_id, created_at desc);
create index p2p_orders_seller_idx on public.p2p_orders (seller_id, created_at desc);
grant select, insert, update on public.p2p_orders to authenticated;
grant all on public.p2p_orders to service_role;
alter table public.p2p_orders enable row level security;
create policy "p2p_orders_party_read" on public.p2p_orders for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid()
     or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'moderator'));

-- ---------- chat ----------
create table public.p2p_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.p2p_orders(id) on delete cascade,
  sender_id uuid,
  body text,
  image_url text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);
create index p2p_messages_order_idx on public.p2p_messages (order_id, created_at);
grant select, insert on public.p2p_messages to authenticated;
grant all on public.p2p_messages to service_role;
alter table public.p2p_messages enable row level security;
create policy "p2p_messages_party_read" on public.p2p_messages for select to authenticated
  using (exists (select 1 from public.p2p_orders o where o.id = order_id
    and (o.buyer_id = auth.uid() or o.seller_id = auth.uid()
      or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'moderator'))));
create policy "p2p_messages_party_insert" on public.p2p_messages for insert to authenticated
  with check (sender_id = auth.uid() and is_system = false
    and exists (select 1 from public.p2p_orders o where o.id = order_id
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid()
        or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'moderator'))));

-- ---------- disputes ----------
create table public.p2p_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.p2p_orders(id) on delete cascade,
  opened_by uuid not null,
  reason text not null,
  status public.p2p_dispute_status not null default 'open',
  moderator_id uuid,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.p2p_disputes to authenticated;
grant all on public.p2p_disputes to service_role;
alter table public.p2p_disputes enable row level security;
create policy "p2p_disputes_party_read" on public.p2p_disputes for select to authenticated
  using (exists (select 1 from public.p2p_orders o where o.id = order_id
    and (o.buyer_id = auth.uid() or o.seller_id = auth.uid()
      or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'moderator'))));

-- ---------- updated_at triggers ----------
create trigger p2p_pm_updated before update on public.p2p_payment_methods
  for each row execute function public.set_updated_at();
create trigger p2p_ads_updated before update on public.p2p_ads
  for each row execute function public.set_updated_at();
create trigger p2p_orders_updated before update on public.p2p_orders
  for each row execute function public.set_updated_at();
create trigger p2p_disputes_updated before update on public.p2p_disputes
  for each row execute function public.set_updated_at();

-- ---------- escrow engine ----------
create or replace function public.p2p_balance_column(_asset text)
returns text language sql immutable set search_path = public as $$
  select case upper(_asset)
    when 'OUSD' then 'ousd_balance'
    when 'USDC' then 'usdc_balance'
    when 'USDT' then 'usdt_balance'
    when 'ETH'  then 'eth_balance'
    when 'BTC'  then 'btc_balance'
    when 'SOL'  then 'sol_balance'
    when 'PYUSD' then 'pyusd_balance'
    when 'EURC' then 'eurc_balance'
    else null end
$$;

create or replace function public.p2p_move_balance(_user_id uuid, _asset text, _delta numeric)
returns void language plpgsql security definer set search_path = public as $$
declare col text; wid uuid; bal numeric;
begin
  col := public.p2p_balance_column(_asset);
  if col is null then raise exception 'Unsupported asset %', _asset; end if;
  select id into wid from public.wallets where user_id = _user_id order by is_active desc, created_at asc limit 1;
  if wid is null then raise exception 'No wallet found for participant'; end if;
  execute format('select %I from public.wallets where id = $1 for update', col) into bal using wid;
  if bal + _delta < 0 then raise exception 'Insufficient % balance', upper(_asset); end if;
  execute format('update public.wallets set %I = %I + $1 where id = $2', col, col) using _delta, wid;
end $$;
revoke all on function public.p2p_move_balance(uuid,text,numeric) from public, anon, authenticated;

create or replace function public.p2p_open_order(_ad_id uuid, _amount numeric, _payment_method text)
returns public.p2p_orders language plpgsql security definer set search_path = public as $$
declare ad public.p2p_ads; o public.p2p_orders; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into ad from public.p2p_ads where id = _ad_id for update;
  if ad is null then raise exception 'Advertisement not found'; end if;
  if ad.status <> 'active' then raise exception 'Advertisement is not active'; end if;
  if ad.user_id = uid then raise exception 'You cannot trade with your own advertisement'; end if;
  if _amount <= 0 or _amount > ad.available_amount then raise exception 'Amount exceeds available'; end if;
  if _amount < ad.min_order or _amount > ad.max_order then raise exception 'Amount outside order limits'; end if;
  if not (_payment_method = any(ad.payment_methods)) then raise exception 'Payment method not accepted'; end if;

  insert into public.p2p_orders (ad_id, buyer_id, seller_id, asset, amount, price_usd, total_fiat,
                                 payment_method, status, escrow_status, escrow_tx_hash, expires_at)
  values (ad.id,
          case when ad.side = 'sell' then uid else ad.user_id end,
          case when ad.side = 'sell' then ad.user_id else uid end,
          ad.asset, _amount, ad.price_usd, round(_amount * ad.price_usd, 2),
          _payment_method, 'pending_payment', 'locked',
          'escrow_' || encode(gen_random_bytes(16),'hex'),
          now() + make_interval(mins => ad.pay_time_limit_minutes))
  returning * into o;

  perform public.p2p_move_balance(o.seller_id, o.asset, -_amount);
  update public.p2p_ads set available_amount = available_amount - _amount where id = ad.id;

  insert into public.p2p_messages (order_id, is_system, body)
  values (o.id, true, format('Escrow locked: %s %s held until the trade completes.', _amount, o.asset));
  return o;
end $$;
grant execute on function public.p2p_open_order(uuid,numeric,text) to authenticated;

create or replace function public.p2p_mark_paid(_order_id uuid, _proof_url text default null)
returns public.p2p_orders language plpgsql security definer set search_path = public as $$
declare o public.p2p_orders; uid uuid := auth.uid();
begin
  select * into o from public.p2p_orders where id = _order_id for update;
  if o is null then raise exception 'Order not found'; end if;
  if o.buyer_id <> uid then raise exception 'Only the buyer can mark payment sent'; end if;
  if o.status <> 'pending_payment' then raise exception 'Order is not awaiting payment'; end if;
  update public.p2p_orders set status = 'paid', paid_at = now(),
    payment_proof_url = coalesce(_proof_url, payment_proof_url)
    where id = _order_id returning * into o;
  insert into public.p2p_messages (order_id, is_system, body)
  values (o.id, true, 'Buyer marked the payment as sent. Waiting for seller confirmation.');
  return o;
end $$;
grant execute on function public.p2p_mark_paid(uuid,text) to authenticated;

create or replace function public.p2p_confirm_received(_order_id uuid)
returns public.p2p_orders language plpgsql security definer set search_path = public as $$
declare o public.p2p_orders; uid uuid := auth.uid();
begin
  select * into o from public.p2p_orders where id = _order_id for update;
  if o is null then raise exception 'Order not found'; end if;
  if o.seller_id <> uid then raise exception 'Only the seller can confirm payment'; end if;
  if o.status <> 'paid' then raise exception 'Buyer has not marked the payment as sent'; end if;
  if o.escrow_status <> 'locked' then raise exception 'Escrow is not locked'; end if;

  perform public.p2p_move_balance(o.buyer_id, o.asset, o.amount);
  update public.p2p_orders set status = 'completed', escrow_status = 'released',
    released_at = now(), release_tx_hash = 'release_' || encode(gen_random_bytes(16),'hex')
    where id = _order_id returning * into o;
  insert into public.p2p_messages (order_id, is_system, body)
  values (o.id, true, format('Escrow released: %s %s sent to the buyer. Trade completed.', o.amount, o.asset));
  return o;
end $$;
grant execute on function public.p2p_confirm_received(uuid) to authenticated;

create or replace function public.p2p_cancel_order(_order_id uuid, _reason text default null)
returns public.p2p_orders language plpgsql security definer set search_path = public as $$
declare o public.p2p_orders; uid uuid := auth.uid();
begin
  select * into o from public.p2p_orders where id = _order_id for update;
  if o is null then raise exception 'Order not found'; end if;
  if uid not in (o.buyer_id, o.seller_id) and not public.has_role(uid,'admin') then
    raise exception 'Not allowed'; end if;
  if o.status not in ('pending_payment','paid') then raise exception 'Order can no longer be cancelled'; end if;
  if o.status = 'paid' and uid = o.seller_id and now() < o.expires_at then
    raise exception 'Buyer marked payment sent — open a dispute instead'; end if;

  perform public.p2p_move_balance(o.seller_id, o.asset, o.amount);
  update public.p2p_ads set available_amount = available_amount + o.amount where id = o.ad_id;
  update public.p2p_orders set status = 'cancelled', escrow_status = 'refunded', cancelled_at = now()
    where id = _order_id returning * into o;
  insert into public.p2p_messages (order_id, is_system, body)
  values (o.id, true, coalesce('Order cancelled: ' || _reason, 'Order cancelled. Escrow refunded to the seller.'));
  return o;
end $$;
grant execute on function public.p2p_cancel_order(uuid,text) to authenticated;

create or replace function public.p2p_open_dispute(_order_id uuid, _reason text)
returns public.p2p_disputes language plpgsql security definer set search_path = public as $$
declare o public.p2p_orders; d public.p2p_disputes; uid uuid := auth.uid();
begin
  select * into o from public.p2p_orders where id = _order_id for update;
  if o is null then raise exception 'Order not found'; end if;
  if uid not in (o.buyer_id, o.seller_id) then raise exception 'Not allowed'; end if;
  if o.status not in ('pending_payment','paid') then raise exception 'Order cannot be disputed'; end if;
  update public.p2p_orders set status = 'disputed', escrow_status = 'frozen' where id = _order_id;
  insert into public.p2p_disputes (order_id, opened_by, reason) values (_order_id, uid, _reason)
    returning * into d;
  insert into public.p2p_messages (order_id, is_system, body)
  values (_order_id, true, 'Dispute opened. Escrow is frozen until a moderator resolves it.');
  return d;
end $$;
grant execute on function public.p2p_open_dispute(uuid,text) to authenticated;

create or replace function public.p2p_resolve_dispute(_order_id uuid, _release_to_buyer boolean, _resolution text)
returns public.p2p_orders language plpgsql security definer set search_path = public as $$
declare o public.p2p_orders; uid uuid := auth.uid();
begin
  if not (public.has_role(uid,'admin') or public.has_role(uid,'moderator')) then
    raise exception 'Moderator or admin only'; end if;
  select * into o from public.p2p_orders where id = _order_id for update;
  if o is null then raise exception 'Order not found'; end if;
  if o.status <> 'disputed' then raise exception 'Order is not disputed'; end if;

  if _release_to_buyer then
    perform public.p2p_move_balance(o.buyer_id, o.asset, o.amount);
    update public.p2p_orders set status = 'completed', escrow_status = 'released',
      released_at = now(), release_tx_hash = 'release_' || encode(gen_random_bytes(16),'hex')
      where id = _order_id returning * into o;
  else
    perform public.p2p_move_balance(o.seller_id, o.asset, o.amount);
    update public.p2p_ads set available_amount = available_amount + o.amount where id = o.ad_id;
    update public.p2p_orders set status = 'cancelled', escrow_status = 'refunded', cancelled_at = now()
      where id = _order_id returning * into o;
  end if;

  update public.p2p_disputes set
    status = case when _release_to_buyer then 'resolved_buyer'::public.p2p_dispute_status
                  else 'resolved_seller'::public.p2p_dispute_status end,
    moderator_id = uid, resolution = _resolution, resolved_at = now()
    where order_id = _order_id;
  insert into public.p2p_messages (order_id, is_system, body)
  values (_order_id, true, 'Dispute resolved by moderator: ' || coalesce(_resolution,''));
  return o;
end $$;
grant execute on function public.p2p_resolve_dispute(uuid,boolean,text) to authenticated;

create or replace function public.p2p_expire_orders()
returns int language plpgsql security definer set search_path = public as $$
declare o public.p2p_orders; n int := 0;
begin
  for o in select * from public.p2p_orders
    where status = 'pending_payment' and expires_at < now() for update
  loop
    perform public.p2p_move_balance(o.seller_id, o.asset, o.amount);
    update public.p2p_ads set available_amount = available_amount + o.amount where id = o.ad_id;
    update public.p2p_orders set status = 'expired', escrow_status = 'refunded', cancelled_at = now()
      where id = o.id;
    insert into public.p2p_messages (order_id, is_system, body)
    values (o.id, true, 'Payment window expired. Escrow refunded to the seller.');
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function public.p2p_expire_orders() to authenticated;
