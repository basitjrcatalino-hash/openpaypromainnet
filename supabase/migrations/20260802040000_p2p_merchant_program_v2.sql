-- P2P merchant program v2:
-- Become merchant: KYC verified + merchant details + ≥100 OUSD in P2P + admin review.
-- Verified badge: 30 days continuous approved merchant status.
-- Order milestones: bonus OUSD at 50 / 100 / 250 / 500 / 1000 completed trades.

alter table public.p2p_merchants
  add column if not exists merchant_name text,
  add column if not exists merchant_region text,
  add column if not exists verified_badge_at timestamptz;

alter table public.p2p_merchant_applications
  add column if not exists merchant_name text,
  add column if not exists merchant_region text;

-- Milestone catalog + claims
create table if not exists public.p2p_merchant_milestones (
  id text primary key,
  order_count int not null unique check (order_count > 0),
  bonus_ousd numeric(38, 8) not null check (bonus_ousd > 0),
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists public.p2p_merchant_milestone_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone_id text not null references public.p2p_merchant_milestones(id) on delete cascade,
  bonus_ousd numeric(38, 8) not null,
  completed_orders int not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, milestone_id)
);

create index if not exists p2p_merchant_milestone_claims_user_idx
  on public.p2p_merchant_milestone_claims (user_id);

alter table public.p2p_merchant_milestones enable row level security;
alter table public.p2p_merchant_milestone_claims enable row level security;

drop policy if exists "p2p_milestones_select" on public.p2p_merchant_milestones;
create policy "p2p_milestones_select"
  on public.p2p_merchant_milestones for select
  to authenticated
  using (is_active = true);

drop policy if exists "p2p_milestone_claims_select_own" on public.p2p_merchant_milestone_claims;
create policy "p2p_milestone_claims_select_own"
  on public.p2p_merchant_milestone_claims for select
  to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

insert into public.p2p_merchant_milestones (id, order_count, bonus_ousd, label, sort_order)
values
  ('orders_50', 50, 10, 'First 50 orders', 10),
  ('orders_100', 100, 25, '100 orders', 20),
  ('orders_250', 250, 50, '250 orders', 30),
  ('orders_500', 500, 100, '500 orders', 40),
  ('orders_1000', 1000, 250, '1,000 orders', 50)
on conflict (id) do update set
  order_count = excluded.order_count,
  bonus_ousd = excluded.bonus_ousd,
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_active = true;

-- Helpers
create or replace function public.p2p_merchant_p2p_ousd(_user_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  wid uuid;
  bal numeric := 0;
begin
  select id into wid
  from public.wallets
  where user_id = _user_id
  order by is_active desc, created_at asc
  limit 1;
  if wid is null then return 0; end if;

  select coalesce(balance, 0) into bal
  from public.wallet_account_balances
  where wallet_id = wid and account = 'p2p' and asset = 'OUSD';

  return coalesce(bal, 0);
end;
$$;

revoke all on function public.p2p_merchant_p2p_ousd(uuid) from public, anon;
grant execute on function public.p2p_merchant_p2p_ousd(uuid) to authenticated;

create or replace function public.p2p_merchant_completed_orders(_user_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.p2p_orders o
  where o.status = 'completed'
    and (o.buyer_id = _user_id or o.seller_id = _user_id);
$$;

revoke all on function public.p2p_merchant_completed_orders(uuid) from public, anon;
grant execute on function public.p2p_merchant_completed_orders(uuid) to authenticated;

-- Verified badge after 30 continuous days as approved merchant.
create or replace function public.p2p_merchant_has_verified_badge(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.p2p_merchants m
    where m.user_id = _user_id
      and m.tier in ('verified', 'super')
      and m.approved_at is not null
      and m.approved_at <= now() - interval '30 days'
  );
$$;

revoke all on function public.p2p_merchant_has_verified_badge(uuid) from public, anon;
grant execute on function public.p2p_merchant_has_verified_badge(uuid) to authenticated;

create or replace function public.p2p_refresh_verified_badge(_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  ok := public.p2p_merchant_has_verified_badge(_user_id);
  if ok then
    update public.p2p_merchants
    set verified_badge_at = coalesce(verified_badge_at, approved_at + interval '30 days'),
        updated_at = now()
    where user_id = _user_id
      and tier in ('verified', 'super')
      and verified_badge_at is null;
  end if;
  return ok;
end;
$$;

revoke all on function public.p2p_refresh_verified_badge(uuid) from public, anon;
grant execute on function public.p2p_refresh_verified_badge(uuid) to authenticated;

-- Listing permission unchanged: approved merchant (verified/super tier).
create or replace function public.p2p_merchant_can_list(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.p2p_merchants m
    where m.user_id = _user_id
      and m.tier in ('verified', 'super')
  );
$$;

-- Apply: KYC + merchant details + ≥100 OUSD in P2P. Admin still approves before ads.
drop function if exists public.p2p_apply_merchant(public.p2p_merchant_tier, text);
drop function if exists public.p2p_apply_merchant(public.p2p_merchant_tier, text, text, text);

create or replace function public.p2p_apply_merchant(
  _requested_tier public.p2p_merchant_tier default 'verified',
  _note text default null,
  _merchant_name text default null,
  _merchant_region text default null
)
returns public.p2p_merchant_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur public.p2p_merchants;
  kyc text;
  ousd_bal numeric;
  completed int;
  name_txt text := nullif(trim(coalesce(_merchant_name, '')), '');
  region_txt text := nullif(trim(coalesce(_merchant_region, '')), '');
  snap jsonb;
  app public.p2p_merchant_applications;
  tier public.p2p_merchant_tier := 'verified';
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  -- Listing applications are always "verified" tier (approved merchant).
  -- Super remains admin-granted only.
  if _requested_tier = 'super' then
    raise exception 'Super Merchant is granted by admin. Apply as merchant first.';
  end if;

  select * into cur from public.p2p_merchants where user_id = uid;
  if cur.tier in ('verified', 'super') then
    raise exception 'You are already an approved merchant';
  end if;

  if exists (
    select 1 from public.p2p_merchant_applications
    where user_id = uid and status = 'pending'
  ) then
    raise exception 'You already have a pending application';
  end if;

  select coalesce(kyc_status::text, 'not_started') into kyc
  from public.profiles
  where id = uid;
  if kyc is distinct from 'verified' then
    raise exception 'Complete KYC verification before applying as a merchant';
  end if;

  if name_txt is null or char_length(name_txt) < 2 then
    raise exception 'Enter your merchant display name';
  end if;
  if region_txt is null or char_length(region_txt) < 2 then
    raise exception 'Enter your region / country';
  end if;

  ousd_bal := public.p2p_merchant_p2p_ousd(uid);
  if ousd_bal < 100 then
    raise exception
      'Transfer at least 100 OUSD into your P2P account before applying (you have % OUSD)',
      round(ousd_bal, 2);
  end if;

  completed := public.p2p_merchant_completed_orders(uid);

  snap := jsonb_build_object(
    'kyc_status', kyc,
    'merchant_name', name_txt,
    'merchant_region', region_txt,
    'p2p_ousd', ousd_bal,
    'min_ousd_required', 100,
    'completed_count', completed,
    'current_tier', coalesce(cur.tier::text, 'none'),
    'requested_at', now()
  );

  insert into public.p2p_merchant_applications (
    user_id, requested_tier, status, checklist_snapshot, applicant_note,
    merchant_name, merchant_region
  ) values (
    uid,
    tier,
    'pending',
    snap,
    nullif(trim(coalesce(_note, '')), ''),
    name_txt,
    region_txt
  )
  returning * into app;

  return app;
end;
$$;

grant execute on function public.p2p_apply_merchant(
  public.p2p_merchant_tier, text, text, text
) to authenticated;

-- Enrich get/fetch with verified badge + merchant details.
drop function if exists public.p2p_get_my_merchant();

create or replace function public.p2p_get_my_merchant()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.p2p_merchants;
  has_badge boolean;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into row from public.p2p_merchants where user_id = uid;
  if row.user_id is null then return null; end if;

  has_badge := public.p2p_refresh_verified_badge(uid);
  select * into row from public.p2p_merchants where user_id = uid;

  return jsonb_build_object(
    'user_id', row.user_id,
    'tier', row.tier,
    'is_featured', row.is_featured
      and (row.featured_until is null or row.featured_until > now()),
    'featured_until', row.featured_until,
    'badge_label', row.badge_label,
    'approved_at', row.approved_at,
    'approved_by', row.approved_by,
    'notes', row.notes,
    'merchant_name', row.merchant_name,
    'merchant_region', row.merchant_region,
    'verified_badge_at', row.verified_badge_at,
    'has_verified_badge', has_badge,
    'created_at', row.created_at,
    'updated_at', row.updated_at
  );
end;
$$;

grant execute on function public.p2p_get_my_merchant() to authenticated;

drop function if exists public.p2p_fetch_merchants(uuid[]);

create or replace function public.p2p_fetch_merchants(_ids uuid[])
returns table (
  user_id uuid,
  tier public.p2p_merchant_tier,
  is_featured boolean,
  featured_until timestamptz,
  badge_label text,
  has_verified_badge boolean,
  merchant_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.user_id,
    m.tier,
    case
      when m.is_featured
        and (m.featured_until is null or m.featured_until > now())
      then true
      else false
    end as is_featured,
    m.featured_until,
    m.badge_label,
    (
      m.tier in ('verified', 'super')
      and m.approved_at is not null
      and m.approved_at <= now() - interval '30 days'
    ) as has_verified_badge,
    m.merchant_name
  from public.p2p_merchants m
  where m.user_id = any(_ids)
    and m.tier in ('verified', 'super');
$$;

grant execute on function public.p2p_fetch_merchants(uuid[]) to authenticated, anon;

-- On approve, copy merchant details onto p2p_merchants.
create or replace function public.admin_review_p2p_merchant(
  _application_id uuid,
  _approve boolean,
  _tier public.p2p_merchant_tier default null,
  _featured boolean default false,
  _admin_note text default null,
  _featured_days int default null
)
returns public.p2p_merchants
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  app public.p2p_merchant_applications;
  next_tier public.p2p_merchant_tier;
  row public.p2p_merchants;
  until_at timestamptz;
begin
  if not public.has_role(uid, 'admin') then
    raise exception 'Admin required';
  end if;

  select * into app
  from public.p2p_merchant_applications
  where id = _application_id
  for update;

  if app.id is null then raise exception 'Application not found'; end if;
  if app.status <> 'pending' then raise exception 'Application is not pending'; end if;

  if not _approve then
    update public.p2p_merchant_applications
    set
      status = 'rejected',
      admin_note = nullif(trim(coalesce(_admin_note, '')), ''),
      reviewed_by = uid,
      reviewed_at = now(),
      updated_at = now()
    where id = app.id;

    select * into row from public.p2p_merchants where user_id = app.user_id;
    return row;
  end if;

  next_tier := coalesce(_tier, app.requested_tier);
  if next_tier not in ('verified', 'super') then
    next_tier := 'verified';
  end if;

  if _featured and _featured_days is not null and _featured_days > 0 then
    until_at := now() + make_interval(days => _featured_days);
  else
    until_at := null;
  end if;

  insert into public.p2p_merchants as m (
    user_id, tier, is_featured, featured_until, approved_at, approved_by, notes,
    merchant_name, merchant_region, updated_at
  ) values (
    app.user_id,
    next_tier,
    coalesce(_featured, false),
    until_at,
    now(),
    uid,
    nullif(trim(coalesce(_admin_note, '')), ''),
    app.merchant_name,
    app.merchant_region,
    now()
  )
  on conflict (user_id) do update set
    tier = excluded.tier,
    is_featured = excluded.is_featured,
    featured_until = excluded.featured_until,
    approved_at = excluded.approved_at,
    approved_by = excluded.approved_by,
    notes = coalesce(excluded.notes, m.notes),
    merchant_name = coalesce(excluded.merchant_name, m.merchant_name),
    merchant_region = coalesce(excluded.merchant_region, m.merchant_region),
    updated_at = now()
  returning * into row;

  update public.p2p_merchant_applications
  set
    status = 'approved',
    admin_note = nullif(trim(coalesce(_admin_note, '')), ''),
    reviewed_by = uid,
    reviewed_at = now(),
    updated_at = now()
  where id = app.id;

  return row;
end;
$$;

grant execute on function public.admin_review_p2p_merchant(
  uuid, boolean, public.p2p_merchant_tier, boolean, text, int
) to authenticated;

-- Merchant program progress + claim bonuses into P2P OUSD.
create or replace function public.p2p_merchant_program_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  completed int;
  can_list boolean;
  has_badge boolean;
  approved_at timestamptz;
  days_left numeric;
  milestones jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  completed := public.p2p_merchant_completed_orders(uid);
  can_list := public.p2p_merchant_can_list(uid);
  has_badge := public.p2p_refresh_verified_badge(uid);

  select m.approved_at into approved_at
  from public.p2p_merchants m
  where m.user_id = uid;

  if can_list and approved_at is not null and not has_badge then
    days_left := greatest(
      0,
      ceil(extract(epoch from ((approved_at + interval '30 days') - now())) / 86400.0)
    );
  else
    days_left := 0;
  end if;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.sort_order), '[]'::jsonb)
  into milestones
  from (
    select
      mil.id,
      mil.order_count,
      mil.bonus_ousd,
      mil.label,
      mil.sort_order,
      (completed >= mil.order_count) as reached,
      (c.milestone_id is not null) as claimed,
      c.claimed_at
    from public.p2p_merchant_milestones mil
    left join public.p2p_merchant_milestone_claims c
      on c.milestone_id = mil.id and c.user_id = uid
    where mil.is_active
  ) x;

  return jsonb_build_object(
    'completed_orders', completed,
    'can_list', can_list,
    'has_verified_badge', has_badge,
    'approved_at', approved_at,
    'verified_badge_days_left', days_left,
    'p2p_ousd', public.p2p_merchant_p2p_ousd(uid),
    'milestones', milestones
  );
end;
$$;

grant execute on function public.p2p_merchant_program_status() to authenticated;

create or replace function public.p2p_claim_merchant_milestones()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  completed int;
  mil record;
  claimed_total numeric := 0;
  claimed_ids text[] := '{}';
  wid uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not public.p2p_merchant_can_list(uid) then
    raise exception 'Merchant approval required before claiming bonuses';
  end if;

  completed := public.p2p_merchant_completed_orders(uid);

  select id into wid
  from public.wallets
  where user_id = uid
  order by is_active desc, created_at asc
  limit 1;
  if wid is null then raise exception 'No wallet found'; end if;

  for mil in
    select m.*
    from public.p2p_merchant_milestones m
    where m.is_active
      and m.order_count <= completed
      and not exists (
        select 1 from public.p2p_merchant_milestone_claims c
        where c.user_id = uid and c.milestone_id = m.id
      )
    order by m.sort_order
  loop
    insert into public.p2p_merchant_milestone_claims (
      user_id, milestone_id, bonus_ousd, completed_orders
    ) values (
      uid, mil.id, mil.bonus_ousd, completed
    );

    perform public.account_bucket_move(wid, 'p2p', 'OUSD', mil.bonus_ousd);

    insert into public.transactions (
      wallet_id, type, status, token_symbol, amount, usd_value, counterparty, memo, tx_hash
    ) values (
      wid,
      'receive',
      'confirmed',
      'OUSD',
      mil.bonus_ousd,
      mil.bonus_ousd,
      'Merchant Program',
      format('merchant_bonus:%s', mil.id),
      'mbonus_' || replace(gen_random_uuid()::text, '-', '')
    );

    claimed_total := claimed_total + mil.bonus_ousd;
    claimed_ids := array_append(claimed_ids, mil.id);
  end loop;

  return jsonb_build_object(
    'ok', true,
    'completed_orders', completed,
    'claimed_ousd', claimed_total,
    'claimed_milestones', to_jsonb(claimed_ids)
  );
end;
$$;

grant execute on function public.p2p_claim_merchant_milestones() to authenticated;

-- Clearer ad-create error copy.
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
  bal numeric;
  reserved numeric;
  ad public.p2p_ads;
  missing text;
  wid uuid;
  asset_u text := upper(_asset);
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if not public.p2p_merchant_can_list(uid) then
    raise exception
      'Merchant approval required. Complete KYC, fund ≥100 OUSD in P2P, apply in P2P → Merchant, then wait for admin approval.';
  end if;

  if _price_usd <= 0 or _total_amount <= 0 then raise exception 'Invalid amount'; end if;
  if _min_order <= 0 or _max_order < _min_order then raise exception 'Invalid order limits'; end if;
  if _max_order > _total_amount then raise exception 'Max order cannot exceed total amount'; end if;
  if coalesce(array_length(_payment_methods, 1), 0) = 0 then
    raise exception 'Select at least one payment method';
  end if;
  if public.p2p_balance_column(asset_u) is null then
    raise exception 'Unsupported asset %', asset_u;
  end if;

  perform public.p2p_assert_trade_limit(asset_u, _total_amount, _price_usd, 'ad total');
  perform public.p2p_assert_trade_limit(asset_u, _max_order, _price_usd, 'max order');
  perform public.p2p_assert_trade_limit(asset_u, _min_order, _price_usd, 'min order');

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

    select id into wid
    from public.wallets
    where user_id = uid
    order by is_active desc, created_at asc
    limit 1;
    if wid is null then
      raise exception 'No wallet found — transfer funds into P2P first';
    end if;

    select coalesce(balance, 0) into bal
    from public.wallet_account_balances
    where wallet_id = wid and account = 'p2p' and asset = asset_u;
    bal := coalesce(bal, 0);

    select coalesce(sum(available_amount), 0) into reserved
    from public.p2p_ads
    where user_id = uid and side = 'sell' and status = 'active' and upper(asset) = asset_u;

    if bal - reserved < _total_amount then
      raise exception
        'Insufficient % in P2P account. Transfer from Funding first. Available for new ads: % (P2P % − reserved %).',
        asset_u,
        greatest(bal - reserved, 0),
        bal,
        reserved;
    end if;
  end if;

  insert into public.p2p_ads (
    user_id, side, asset, price_usd, total_amount, available_amount,
    min_order, max_order, payment_methods, pay_time_limit_minutes, terms
  ) values (
    uid, _side, asset_u, _price_usd, _total_amount, _total_amount,
    _min_order, _max_order, _payment_methods, _pay_time_limit_minutes, nullif(trim(_terms), '')
  )
  returning * into ad;
  return ad;
end;
$$;

grant execute on function public.p2p_create_ad(
  public.p2p_ad_side, text, numeric, numeric, numeric, numeric, text[], int, text
) to authenticated;
