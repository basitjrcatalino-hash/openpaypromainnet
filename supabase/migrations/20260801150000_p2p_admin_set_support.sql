-- Admin: assign P2P Support (moderator) by username + wallet address.

create or replace function public.admin_resolve_user_by_username_wallet(
  _username text,
  _wallet_address text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uname text := lower(trim(coalesce(_username, '')));
  addr text := lower(trim(coalesce(_wallet_address, '')));
  uid_from_name uuid;
  uid_from_wallet uuid;
begin
  if uname = '' or addr = '' then
    raise exception 'Username and wallet address are required';
  end if;

  -- Strip @ prefix if pasted from social/handles
  if left(uname, 1) = '@' then
    uname := substr(uname, 2);
  end if;

  select p.id into uid_from_name
  from public.profiles p
  where lower(coalesce(p.username, '')) = uname
     or lower(coalesce(p.display_name, '')) = uname
     or lower(coalesce(p.pi_username, '')) = uname
  order by case when lower(coalesce(p.username, '')) = uname then 0 else 1 end
  limit 1;

  if uid_from_name is null then
    raise exception 'No user found for username "%"', _username;
  end if;

  select w.user_id into uid_from_wallet
  from public.wallets w
  where lower(trim(w.address)) = addr
    and w.user_id = uid_from_name
  order by w.is_active desc, w.created_at asc
  limit 1;

  if uid_from_wallet is null then
    -- Also allow profile-linked Pi wallet
    select p.id into uid_from_wallet
    from public.profiles p
    where p.id = uid_from_name
      and lower(trim(coalesce(p.pi_wallet_address, ''))) = addr
    limit 1;
  end if;

  if uid_from_wallet is null then
    raise exception
      'Wallet address does not match that username. Both must belong to the same account.';
  end if;

  return uid_from_name;
end;
$$;

revoke all on function public.admin_resolve_user_by_username_wallet(text, text)
  from public, anon, authenticated;

create or replace function public.admin_set_p2p_support(
  _username text,
  _wallet_address text,
  _grant boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid := auth.uid();
  target uuid;
  uname text;
  addr text;
begin
  if admin_id is null then raise exception 'Not authenticated'; end if;
  if not public.has_role(admin_id, 'admin') then
    raise exception 'Admin only';
  end if;

  target := public.admin_resolve_user_by_username_wallet(_username, _wallet_address);

  if target = admin_id and _grant is false then
    raise exception 'You cannot remove your own support/admin access this way';
  end if;

  if _grant then
    insert into public.user_roles (user_id, role)
    values (target, 'moderator')
    on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles
    where user_id = target and role = 'moderator';
  end if;

  select coalesce(nullif(trim(p.username), ''), nullif(trim(p.display_name), ''), 'user')
    into uname
  from public.profiles p where p.id = target;

  select w.address into addr
  from public.wallets w
  where w.user_id = target
  order by w.is_active desc, w.created_at asc
  limit 1;

  return jsonb_build_object(
    'user_id', target,
    'username', uname,
    'wallet_address', addr,
    'support', _grant,
    'role', 'moderator'
  );
end;
$$;

revoke all on function public.admin_set_p2p_support(text, text, boolean) from public, anon;
grant execute on function public.admin_set_p2p_support(text, text, boolean) to authenticated;

create or replace function public.admin_list_p2p_support()
returns table (
  user_id uuid,
  username text,
  display_name text,
  wallet_address text,
  role public.app_role,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'moderator')
  ) then
    raise exception 'Admin or support access required';
  end if;

  return query
  select
    ur.user_id,
    p.username,
    p.display_name,
    (
      select w.address
      from public.wallets w
      where w.user_id = ur.user_id
      order by w.is_active desc, w.created_at asc
      limit 1
    ) as wallet_address,
    ur.role,
    ur.created_at
  from public.user_roles ur
  left join public.profiles p on p.id = ur.user_id
  where ur.role in ('moderator'::public.app_role, 'admin'::public.app_role)
  order by
    case when ur.role = 'admin' then 0 else 1 end,
    ur.created_at asc;
end;
$$;

revoke all on function public.admin_list_p2p_support() from public, anon;
grant execute on function public.admin_list_p2p_support() to authenticated;
