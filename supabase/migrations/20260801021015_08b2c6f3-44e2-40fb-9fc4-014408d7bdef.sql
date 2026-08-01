create or replace function public.p2p_display_names(_ids uuid[])
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         coalesce(nullif(p.username,''), nullif(p.display_name,''), nullif(p.pi_username,''),
                  'Trader ' || upper(substr(p.id::text,1,4))) as name
  from public.profiles p
  where p.id = any(_ids)
$$;
revoke all on function public.p2p_display_names(uuid[]) from public, anon;
grant execute on function public.p2p_display_names(uuid[]) to authenticated;