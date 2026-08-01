-- Admin-controlled listing flags for OpenTokens (Featured / Trending / Top Volume).
alter table public.tokens
  add column if not exists is_trending boolean not null default false;

alter table public.tokens
  add column if not exists is_top_volume boolean not null default false;

create index if not exists tokens_featured_idx
  on public.tokens (is_featured desc, market_cap desc)
  where is_hidden = false;

create index if not exists tokens_trending_idx
  on public.tokens (is_trending desc, volume_24h desc)
  where is_hidden = false;

create index if not exists tokens_top_volume_idx
  on public.tokens (is_top_volume desc, volume_24h desc)
  where is_hidden = false;
