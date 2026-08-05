-- Allow 1-character market symbols (e.g. MemeCore "M") in Spot / Perp CHECKs.

create or replace function public.is_trade_market_symbol(m text)
returns boolean
language sql
immutable
as $$
  select upper(coalesce(m, '')) ~ '^[A-Z0-9]{1,16}$';
$$;
