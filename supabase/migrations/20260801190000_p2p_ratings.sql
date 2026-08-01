-- P2P post-trade ratings (OKX / Binance style merchant reputation).

create table if not exists public.p2p_ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.p2p_orders(id) on delete cascade,
  rater_id uuid not null references auth.users(id) on delete cascade,
  ratee_id uuid not null references auth.users(id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  tags text[] not null default '{}'::text[],
  comment text,
  created_at timestamptz not null default now(),
  constraint p2p_ratings_not_self check (rater_id <> ratee_id),
  constraint p2p_ratings_comment_len check (
    comment is null or char_length(trim(comment)) <= 500
  ),
  unique (order_id, rater_id)
);

create index if not exists p2p_ratings_ratee_idx
  on public.p2p_ratings (ratee_id, created_at desc);

create index if not exists p2p_ratings_order_idx
  on public.p2p_ratings (order_id);

alter table public.p2p_ratings enable row level security;

drop policy if exists "p2p_ratings_select_auth" on public.p2p_ratings;
create policy "p2p_ratings_select_auth"
  on public.p2p_ratings for select
  to authenticated
  using (true);

drop policy if exists "p2p_ratings_insert_own" on public.p2p_ratings;
create policy "p2p_ratings_insert_own"
  on public.p2p_ratings for insert
  to authenticated
  with check (rater_id = auth.uid());

create or replace function public.p2p_submit_rating(
  _order_id uuid,
  _score int,
  _tags text[] default '{}'::text[],
  _comment text default null
)
returns public.p2p_ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  o public.p2p_orders;
  ratee uuid;
  row public.p2p_ratings;
  clean_tags text[];
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if _score is null or _score < 1 or _score > 5 then
    raise exception 'Score must be between 1 and 5';
  end if;

  select * into o from public.p2p_orders where id = _order_id;
  if o.id is null then raise exception 'Order not found'; end if;
  if o.status <> 'completed' then
    raise exception 'You can only rate completed trades';
  end if;
  if uid <> o.buyer_id and uid <> o.seller_id then
    raise exception 'Not a party to this order';
  end if;

  ratee := case when uid = o.buyer_id then o.seller_id else o.buyer_id end;

  select coalesce(
    (
      select array_agg(x.t)
      from (
        select distinct trim(t) as t
        from unnest(coalesce(_tags, '{}'::text[])) as t
        where char_length(trim(t)) between 2 and 40
        limit 8
      ) x
    ),
    '{}'::text[]
  )
  into clean_tags;

  insert into public.p2p_ratings (order_id, rater_id, ratee_id, score, tags, comment)
  values (
    _order_id,
    uid,
    ratee,
    _score,
    coalesce(clean_tags, '{}'::text[]),
    nullif(trim(coalesce(_comment, '')), '')
  )
  on conflict (order_id, rater_id) do update set
    score = excluded.score,
    tags = excluded.tags,
    comment = excluded.comment
  returning * into row;

  return row;
end;
$$;

grant execute on function public.p2p_submit_rating(uuid, int, text[], text) to authenticated;

create or replace function public.p2p_my_rating_for_order(_order_id uuid)
returns public.p2p_ratings
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.p2p_ratings;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into row
  from public.p2p_ratings
  where order_id = _order_id and rater_id = uid;
  return row;
end;
$$;

grant execute on function public.p2p_my_rating_for_order(uuid) to authenticated;

create or replace function public.p2p_rating_stats(_ids uuid[])
returns table (
  id uuid,
  rating_count bigint,
  avg_score numeric,
  positive_rate numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      u.id as trader_id,
      count(r.id) as rating_count,
      avg(r.score::numeric) as avg_score,
      count(*) filter (where r.score >= 4) as positive_count
    from unnest(_ids) as u(id)
    left join public.p2p_ratings r on r.ratee_id = u.id
    group by u.id
  )
  select
    trader_id as id,
    coalesce(rating_count, 0) as rating_count,
    case when coalesce(rating_count, 0) = 0 then null else round(avg_score, 2) end as avg_score,
    case
      when coalesce(rating_count, 0) = 0 then null
      else round((positive_count::numeric / rating_count::numeric) * 100, 2)
    end as positive_rate
  from base;
$$;

grant execute on function public.p2p_rating_stats(uuid[]) to authenticated, anon;
