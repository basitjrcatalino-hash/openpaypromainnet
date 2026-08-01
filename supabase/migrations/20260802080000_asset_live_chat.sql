-- Per-asset live chat rooms (majors, OUSD, and any string room_id).
-- OpenToken UUID rooms can also use this; existing ot_token_chat_messages stays for OT.

create table if not exists public.asset_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'gif', 'sticker', 'emoji')),
  body text not null default '',
  media_url text,
  created_at timestamptz not null default now()
);

create index if not exists asset_chat_messages_room_idx
  on public.asset_chat_messages (room_id, created_at desc);

alter table public.asset_chat_messages enable row level security;

drop policy if exists "acm_select" on public.asset_chat_messages;
create policy "acm_select" on public.asset_chat_messages
  for select to authenticated
  using (true);

drop policy if exists "acm_insert" on public.asset_chat_messages;
create policy "acm_insert" on public.asset_chat_messages
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "acm_delete_own" on public.asset_chat_messages;
create policy "acm_delete_own" on public.asset_chat_messages
  for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.asset_chat_messages to authenticated;
grant all on public.asset_chat_messages to service_role;

-- Realtime (ignore if already added)
do $$
begin
  alter publication supabase_realtime add table public.asset_chat_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
