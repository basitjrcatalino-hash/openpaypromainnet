-- Widen Spot / Perpetual market CHECKs for Master Token Registry listings.
-- Validation of listed symbols remains in app code (src/lib/trade-markets.ts).

create or replace function public.is_trade_market_symbol(m text)
returns boolean
language sql
immutable
as $$
  select upper(coalesce(m, '')) ~ '^[A-Z0-9]{1,16}$';
$$;

do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'c'
      and a.attname = 'market'
      and c.conrelid::regclass::text in (
        'public.perp_positions',
        'public.spot_orders',
        'public.spot_fills',
        'public.trade_favorites',
        'public.perp_funding_payments'
      )
  loop
    execute format('alter table %s drop constraint if exists %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.perp_positions
  drop constraint if exists perp_positions_market_check;
alter table public.perp_positions
  add constraint perp_positions_market_check
  check (public.is_trade_market_symbol(market));

alter table public.spot_orders
  drop constraint if exists spot_orders_market_check;
alter table public.spot_orders
  add constraint spot_orders_market_check
  check (public.is_trade_market_symbol(market));

do $$
begin
  if to_regclass('public.spot_fills') is not null then
    execute $c$
      alter table public.spot_fills drop constraint if exists spot_fills_market_check;
      alter table public.spot_fills
        add constraint spot_fills_market_check
        check (public.is_trade_market_symbol(market));
    $c$;
  end if;
  if to_regclass('public.trade_favorites') is not null then
    execute $c$
      alter table public.trade_favorites drop constraint if exists trade_favorites_market_check;
      alter table public.trade_favorites
        add constraint trade_favorites_market_check
        check (public.is_trade_market_symbol(market));
    $c$;
  end if;
  if to_regclass('public.perp_funding_payments') is not null then
    execute $c$
      alter table public.perp_funding_payments drop constraint if exists perp_funding_payments_market_check;
      alter table public.perp_funding_payments
        add constraint perp_funding_payments_market_check
        check (public.is_trade_market_symbol(market));
    $c$;
  end if;
end $$;

-- Soften hard-coded market allow-lists inside trading RPCs (if present).
do $$
declare
  r record;
  src text;
  next text;
begin
  for r in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_get_functiondef(p.oid) ilike '%market_u not in (''BTC''%'
  loop
    src := r.def;
    next := regexp_replace(
      src,
      'if market_u not in \(''BTC''[, ]*''ETH''[, ]*''SOL''[, ]*''PI''\) then[\s\S]*?end if;',
      'if not public.is_trade_market_symbol(market_u) then raise exception ''Unsupported market''; end if;',
      'gi'
    );
    if next is distinct from src then
      execute next;
    end if;
  end loop;
end $$;
