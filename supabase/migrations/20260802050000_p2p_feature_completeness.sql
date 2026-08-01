-- P2P feature completeness:
-- 1) Protect P2P transfers against active sell-ad reservations
-- 2) Close ad RPC (recorded status=closed)
-- 3) List ratings received for Reviews page
-- 4) Ensure merchant can_list still gates ad activation

-- Reserved sell-ad amount for a wallet+asset (active ads only).
create or replace function public.p2p_reserved_sell_amount(_wallet_id uuid, _asset text)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid;
  asset_u text := upper(_asset);
  reserved numeric := 0;
begin
  select user_id into uid from public.wallets where id = _wallet_id;
  if uid is null then return 0; end if;

  select coalesce(sum(available_amount), 0) into reserved
  from public.p2p_ads
  where user_id = uid
    and side = 'sell'
    and status = 'active'
    and upper(asset) = asset_u;

  return coalesce(reserved, 0);
end;
$$;

revoke all on function public.p2p_reserved_sell_amount(uuid, text) from public, anon;
grant execute on function public.p2p_reserved_sell_amount(uuid, text) to authenticated;

-- Harden bucket moves: cannot drain P2P below active sell reservations.
create or replace function public.account_bucket_move(
  _wallet_id uuid,
  _account text,
  _asset text,
  _delta numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bal numeric;
  reserved numeric;
  a text := lower(_account);
  asset_u text := upper(_asset);
begin
  if a not in ('trading', 'p2p') then
    raise exception 'Invalid account bucket %', _account;
  end if;
  if public.p2p_balance_column(asset_u) is null then
    raise exception 'Unsupported asset %', asset_u;
  end if;

  insert into public.wallet_account_balances (wallet_id, account, asset, balance)
  values (_wallet_id, a, asset_u, 0)
  on conflict (wallet_id, account, asset) do nothing;

  select balance into bal
  from public.wallet_account_balances
  where wallet_id = _wallet_id and account = a and asset = asset_u
  for update;

  if bal + _delta < 0 then
    raise exception 'Insufficient % balance in % account', asset_u, a;
  end if;

  if a = 'p2p' and _delta < 0 then
    reserved := public.p2p_reserved_sell_amount(_wallet_id, asset_u);
    if bal + _delta < reserved then
      raise exception
        'Cannot move % from P2P: % reserved by active sell ads (balance %, free %). Pause or close sell ads first.',
        asset_u,
        reserved,
        bal,
        greatest(bal - reserved, 0);
    end if;
  end if;

  update public.wallet_account_balances
  set balance = balance + _delta, updated_at = now()
  where wallet_id = _wallet_id and account = a and asset = asset_u;
end;
$$;

revoke all on function public.account_bucket_move(uuid, text, text, numeric)
  from public, anon, authenticated;

-- Close an ad (owner only). Recorded as status=closed.
create or replace function public.p2p_close_ad(_ad_id uuid)
returns public.p2p_ads
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ad public.p2p_ads;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  update public.p2p_ads
  set status = 'closed', updated_at = now()
  where id = _ad_id and user_id = uid and status <> 'closed'
  returning * into ad;

  if ad.id is null then
    raise exception 'Ad not found or already closed';
  end if;
  return ad;
end;
$$;

grant execute on function public.p2p_close_ad(uuid) to authenticated;

-- Pause / activate own ad with merchant gate on activate.
create or replace function public.p2p_set_ad_status(_ad_id uuid, _status public.p2p_ad_status)
returns public.p2p_ads
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ad public.p2p_ads;
  wid uuid;
  bal numeric;
  reserved numeric;
  asset_u text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if _status not in ('active', 'paused', 'closed') then
    raise exception 'Invalid status';
  end if;

  select * into ad from public.p2p_ads where id = _ad_id for update;
  if ad.id is null or ad.user_id <> uid then
    raise exception 'Ad not found';
  end if;
  if ad.status = 'closed' then
    raise exception 'Closed ads cannot be reopened — create a new ad';
  end if;

  if _status = 'active' and not public.p2p_merchant_can_list(uid) then
    raise exception 'Merchant approval required to activate ads';
  end if;

  -- Re-check P2P coverage when activating a sell ad.
  if _status = 'active' and ad.side = 'sell' then
    asset_u := upper(ad.asset);
    select id into wid from public.wallets
    where user_id = uid order by is_active desc, created_at asc limit 1;
    if wid is null then raise exception 'No wallet found'; end if;

    select coalesce(balance, 0) into bal
    from public.wallet_account_balances
    where wallet_id = wid and account = 'p2p' and asset = asset_u;
    bal := coalesce(bal, 0);

    select coalesce(sum(available_amount), 0) into reserved
    from public.p2p_ads
    where user_id = uid and side = 'sell' and status = 'active'
      and upper(asset) = asset_u and id <> ad.id;

    if bal - reserved < ad.available_amount then
      raise exception
        'Insufficient % in P2P to activate. Need % free (balance % − other reserved %).',
        asset_u, ad.available_amount, bal, reserved;
    end if;
  end if;

  update public.p2p_ads
  set status = _status, updated_at = now()
  where id = ad.id
  returning * into ad;

  return ad;
end;
$$;

grant execute on function public.p2p_set_ad_status(uuid, public.p2p_ad_status) to authenticated;

-- Ratings received by current user (for Reviews page).
create or replace function public.p2p_list_my_ratings(_limit int default 30)
returns table (
  id uuid,
  order_id uuid,
  rater_id uuid,
  score smallint,
  tags text[],
  comment text,
  created_at timestamptz,
  asset text,
  amount numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lim int := greatest(1, least(coalesce(_limit, 30), 100));
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  return query
  select
    r.id,
    r.order_id,
    r.rater_id,
    r.score,
    r.tags,
    r.comment,
    r.created_at,
    o.asset,
    o.amount
  from public.p2p_ratings r
  join public.p2p_orders o on o.id = r.order_id
  where r.ratee_id = uid
  order by r.created_at desc
  limit lim;
end;
$$;

grant execute on function public.p2p_list_my_ratings(int) to authenticated;
