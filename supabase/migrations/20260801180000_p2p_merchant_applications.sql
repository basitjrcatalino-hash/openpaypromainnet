-- P2P merchant program: apply → admin approve → badges / featured listing (OKX / Binance style).

do $$ begin
  create type public.p2p_merchant_tier as enum ('none', 'verified', 'super');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.p2p_application_status as enum ('pending', 'approved', 'rejected', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.p2p_merchants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier public.p2p_merchant_tier not null default 'none',
  is_featured boolean not null default false,
  featured_until timestamptz,
  badge_label text,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint p2p_merchants_featured_requires_tier
    check (not is_featured or tier in ('verified', 'super'))
);

create index if not exists p2p_merchants_featured_idx
  on public.p2p_merchants (is_featured desc, tier, updated_at desc)
  where tier <> 'none';

create table if not exists public.p2p_merchant_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_tier public.p2p_merchant_tier not null default 'verified',
  status public.p2p_application_status not null default 'pending',
  checklist_snapshot jsonb not null default '{}'::jsonb,
  applicant_note text,
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint p2p_merchant_applications_tier_chk
    check (requested_tier in ('verified', 'super'))
);

create unique index if not exists p2p_merchant_applications_one_pending
  on public.p2p_merchant_applications (user_id)
  where status = 'pending';

create index if not exists p2p_merchant_applications_status_idx
  on public.p2p_merchant_applications (status, created_at desc);

alter table public.p2p_merchants enable row level security;
alter table public.p2p_merchant_applications enable row level security;

drop policy if exists "p2p_merchants_select_all" on public.p2p_merchants;
create policy "p2p_merchants_select_all"
  on public.p2p_merchants for select
  to authenticated
  using (true);

drop policy if exists "p2p_merchants_admin_write" on public.p2p_merchants;
create policy "p2p_merchants_admin_write"
  on public.p2p_merchants for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "p2p_apps_select_own_or_staff" on public.p2p_merchant_applications;
create policy "p2p_apps_select_own_or_staff"
  on public.p2p_merchant_applications for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'moderator')
  );

drop policy if exists "p2p_apps_insert_own" on public.p2p_merchant_applications;
create policy "p2p_apps_insert_own"
  on public.p2p_merchant_applications for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "p2p_apps_update_own_cancel" on public.p2p_merchant_applications;
create policy "p2p_apps_update_own_cancel"
  on public.p2p_merchant_applications for update
  to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid());

drop policy if exists "p2p_apps_admin_write" on public.p2p_merchant_applications;
create policy "p2p_apps_admin_write"
  on public.p2p_merchant_applications for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Seed: anyone who already published ads becomes verified so existing market keeps working.
insert into public.p2p_merchants (user_id, tier, approved_at, notes)
select distinct a.user_id, 'verified'::public.p2p_merchant_tier, now(), 'Auto-verified from existing ads'
from public.p2p_ads a
on conflict (user_id) do nothing;

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

revoke all on function public.p2p_merchant_can_list(uuid) from public, anon;
grant execute on function public.p2p_merchant_can_list(uuid) to authenticated;

create or replace function public.p2p_get_my_merchant()
returns public.p2p_merchants
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.p2p_merchants;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into row from public.p2p_merchants where user_id = uid;
  return row;
end;
$$;

grant execute on function public.p2p_get_my_merchant() to authenticated;

create or replace function public.p2p_fetch_merchants(_ids uuid[])
returns table (
  user_id uuid,
  tier public.p2p_merchant_tier,
  is_featured boolean,
  featured_until timestamptz,
  badge_label text
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
    m.badge_label
  from public.p2p_merchants m
  where m.user_id = any(_ids)
    and m.tier in ('verified', 'super');
$$;

grant execute on function public.p2p_fetch_merchants(uuid[]) to authenticated, anon;

create or replace function public.p2p_apply_merchant(
  _requested_tier public.p2p_merchant_tier default 'verified',
  _note text default null
)
returns public.p2p_merchant_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur public.p2p_merchants;
  accounts int;
  completed bigint;
  rate numeric;
  avg_pay numeric;
  snap jsonb;
  app public.p2p_merchant_applications;
  tier public.p2p_merchant_tier := _requested_tier;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if tier not in ('verified', 'super') then
    raise exception 'Choose verified or super merchant';
  end if;

  select * into cur from public.p2p_merchants where user_id = uid;

  if tier = 'verified' and cur.tier in ('verified', 'super') then
    raise exception 'You are already an approved merchant';
  end if;
  if tier = 'super' and cur.tier = 'super' then
    raise exception 'You are already a Super Merchant';
  end if;
  if tier = 'super' and (cur.tier is null or cur.tier = 'none') then
    raise exception 'Become a Verified Merchant first, then apply for Super Merchant';
  end if;

  if exists (
    select 1 from public.p2p_merchant_applications
    where user_id = uid and status = 'pending'
  ) then
    raise exception 'You already have a pending application';
  end if;

  select count(*)::int into accounts
  from public.p2p_payment_accounts
  where user_id = uid and is_active = true;

  select
    count(*) filter (where o.status = 'completed'),
    case
      when count(*) filter (
        where o.status in ('completed', 'cancelled', 'expired', 'disputed')
      ) = 0 then null
      else round(
        (
          count(*) filter (where o.status = 'completed')::numeric
          / nullif(
            count(*) filter (
              where o.status in ('completed', 'cancelled', 'expired', 'disputed')
            ),
            0
          )::numeric
        ) * 100,
        2
      )
    end,
    avg(extract(epoch from (o.paid_at - o.created_at)))
      filter (where o.paid_at is not null)
  into completed, rate, avg_pay
  from public.p2p_orders o
  where o.buyer_id = uid or o.seller_id = uid;

  snap := jsonb_build_object(
    'completed_count', coalesce(completed, 0),
    'completion_rate', rate,
    'avg_pay_seconds', avg_pay,
    'active_accounts', coalesce(accounts, 0),
    'current_tier', coalesce(cur.tier::text, 'none'),
    'requested_at', now()
  );

  if tier = 'verified' then
    if coalesce(accounts, 0) < 1 then
      raise exception 'Add at least one receive payment method before applying';
    end if;
  else
    -- Super Merchant eligibility (admin still must approve)
    if coalesce(completed, 0) < 10 then
      raise exception 'Super Merchant needs 10+ completed trades (you have %)', coalesce(completed, 0);
    end if;
    if rate is null or rate < 95 then
      raise exception 'Super Merchant needs ≥ 95%% completion rate';
    end if;
    if coalesce(accounts, 0) < 2 then
      raise exception 'Super Merchant needs 2+ active receive methods';
    end if;
    if avg_pay is not null and avg_pay > 15 * 60 then
      raise exception 'Super Merchant needs average payment time ≤ 15 minutes';
    end if;
  end if;

  insert into public.p2p_merchant_applications (
    user_id, requested_tier, status, checklist_snapshot, applicant_note
  ) values (
    uid,
    tier,
    'pending',
    snap,
    nullif(trim(coalesce(_note, '')), '')
  )
  returning * into app;

  return app;
end;
$$;

grant execute on function public.p2p_apply_merchant(public.p2p_merchant_tier, text) to authenticated;

create or replace function public.p2p_cancel_merchant_application(_id uuid)
returns public.p2p_merchant_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  app public.p2p_merchant_applications;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  update public.p2p_merchant_applications
  set status = 'cancelled', updated_at = now()
  where id = _id and user_id = uid and status = 'pending'
  returning * into app;
  if app.id is null then raise exception 'Pending application not found'; end if;
  return app;
end;
$$;

grant execute on function public.p2p_cancel_merchant_application(uuid) to authenticated;

create or replace function public.admin_list_p2p_merchant_applications(_status text default 'pending')
returns setof public.p2p_merchant_applications
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'moderator')
  ) then
    raise exception 'Admin or moderator required';
  end if;

  return query
  select *
  from public.p2p_merchant_applications
  where (_status = 'all' or status::text = _status)
  order by created_at desc
  limit 100;
end;
$$;

grant execute on function public.admin_list_p2p_merchant_applications(text) to authenticated;

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
    user_id, tier, is_featured, featured_until, approved_at, approved_by, notes, updated_at
  ) values (
    app.user_id,
    next_tier,
    coalesce(_featured, false),
    until_at,
    now(),
    uid,
    nullif(trim(coalesce(_admin_note, '')), ''),
    now()
  )
  on conflict (user_id) do update set
    tier = excluded.tier,
    is_featured = excluded.is_featured,
    featured_until = excluded.featured_until,
    approved_at = excluded.approved_at,
    approved_by = excluded.approved_by,
    notes = coalesce(excluded.notes, m.notes),
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

create or replace function public.admin_set_p2p_merchant(
  _user_id uuid,
  _tier public.p2p_merchant_tier,
  _featured boolean default false,
  _featured_days int default null,
  _note text default null
)
returns public.p2p_merchants
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.p2p_merchants;
  until_at timestamptz;
begin
  if not public.has_role(uid, 'admin') then
    raise exception 'Admin required';
  end if;

  if _tier = 'none' then
    update public.p2p_ads
    set status = 'paused', updated_at = now()
    where user_id = _user_id and status = 'active';

    insert into public.p2p_merchants as m (
      user_id, tier, is_featured, featured_until, notes, updated_at
    ) values (
      _user_id, 'none', false, null, nullif(trim(coalesce(_note, '')), ''), now()
    )
    on conflict (user_id) do update set
      tier = 'none',
      is_featured = false,
      featured_until = null,
      notes = coalesce(excluded.notes, m.notes),
      updated_at = now()
    returning * into row;
    return row;
  end if;

  if _featured and _featured_days is not null and _featured_days > 0 then
    until_at := now() + make_interval(days => _featured_days);
  elsif not _featured then
    until_at := null;
  else
    until_at := null;
  end if;

  insert into public.p2p_merchants as m (
    user_id, tier, is_featured, featured_until, approved_at, approved_by, notes, updated_at
  ) values (
    _user_id,
    _tier,
    coalesce(_featured, false),
    until_at,
    now(),
    uid,
    nullif(trim(coalesce(_note, '')), ''),
    now()
  )
  on conflict (user_id) do update set
    tier = excluded.tier,
    is_featured = excluded.is_featured,
    featured_until = case
      when excluded.is_featured then coalesce(excluded.featured_until, m.featured_until)
      else null
    end,
    approved_at = coalesce(m.approved_at, now()),
    approved_by = uid,
    notes = coalesce(excluded.notes, m.notes),
    updated_at = now()
  returning * into row;

  return row;
end;
$$;

grant execute on function public.admin_set_p2p_merchant(
  uuid, public.p2p_merchant_tier, boolean, int, text
) to authenticated;

-- Gate ad listing behind approved merchant (verified or super).
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

  if not public.p2p_merchant_can_list(uid) then
    raise exception
      'Merchant approval required. Apply in P2P → Become a Super Merchant / Apply as merchant, then wait for admin approval before listing ads.';
  end if;

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

-- Prevent re-activating ads after merchant revoke (RLS-friendly via trigger).
create or replace function public.p2p_ads_require_merchant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and not public.p2p_merchant_can_list(new.user_id) then
    raise exception 'Merchant approval required to activate ads';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_p2p_ads_require_merchant on public.p2p_ads;
create trigger trg_p2p_ads_require_merchant
  before insert or update of status on public.p2p_ads
  for each row
  execute function public.p2p_ads_require_merchant();
