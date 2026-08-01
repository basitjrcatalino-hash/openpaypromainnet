-- Trader reputation stats for OKX-style P2P merchant cards / profile.

create or replace function public.p2p_trader_stats(_ids uuid[])
returns table (
  id uuid,
  completed_count bigint,
  completion_rate numeric,
  avg_pay_seconds numeric,
  last_active_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      u.id as trader_id,
      count(*) filter (where o.status = 'completed') as completed_count,
      count(*) filter (
        where o.status in ('completed', 'cancelled', 'expired', 'disputed')
      ) as closed_count,
      avg(
        extract(epoch from (o.paid_at - o.created_at))
      ) filter (where o.paid_at is not null) as avg_pay_seconds,
      max(greatest(o.updated_at, o.created_at)) as last_active_at
    from unnest(_ids) as u(id)
    left join public.p2p_orders o
      on o.buyer_id = u.id or o.seller_id = u.id
    group by u.id
  )
  select
    trader_id as id,
    coalesce(completed_count, 0) as completed_count,
    case
      when coalesce(closed_count, 0) = 0 then null
      else round((completed_count::numeric / closed_count::numeric) * 100, 2)
    end as completion_rate,
    avg_pay_seconds,
    last_active_at
  from base;
$$;

grant execute on function public.p2p_trader_stats(uuid[]) to authenticated, anon;
