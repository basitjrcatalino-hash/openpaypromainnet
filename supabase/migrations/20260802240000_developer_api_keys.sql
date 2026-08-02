-- Per-user OpenPay Pro developer API keys (integration portal).
-- Prefix: opdk_…  Plaintext shown once; only SHA-256 hash stored.

create table if not exists public.developer_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default array['inbound', 'receive']::text[],
  active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists developer_api_keys_user_idx
  on public.developer_api_keys (user_id, created_at desc);

create index if not exists developer_api_keys_hash_idx
  on public.developer_api_keys (key_hash)
  where active = true;

comment on table public.developer_api_keys is
  'User-scoped API keys for OpenPay Pro developer portal (inbound receive to own wallet).';

alter table public.developer_api_keys enable row level security;

drop policy if exists "developer_api_keys_select_own" on public.developer_api_keys;
create policy "developer_api_keys_select_own"
  on public.developer_api_keys for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "developer_api_keys_insert_own" on public.developer_api_keys;
create policy "developer_api_keys_insert_own"
  on public.developer_api_keys for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "developer_api_keys_update_own" on public.developer_api_keys;
create policy "developer_api_keys_update_own"
  on public.developer_api_keys for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No client deletes — revoke via active=false
drop policy if exists "developer_api_keys_no_delete" on public.developer_api_keys;
create policy "developer_api_keys_no_delete"
  on public.developer_api_keys for delete to authenticated
  using (false);

grant select, insert, update on public.developer_api_keys to authenticated;
grant all on public.developer_api_keys to service_role;
