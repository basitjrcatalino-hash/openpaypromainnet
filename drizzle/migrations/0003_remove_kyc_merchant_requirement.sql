-- KYC is removed from OpenPay Pro: merchant applications no longer require identity verification.
CREATE OR REPLACE FUNCTION public.p2p_apply_merchant(_requested_tier p2p_merchant_tier DEFAULT 'verified'::p2p_merchant_tier, _note text DEFAULT NULL::text, _merchant_name text DEFAULT NULL::text, _merchant_region text DEFAULT NULL::text)
 RETURNS p2p_merchant_applications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  cur public.p2p_merchants;
  ousd_bal numeric;
  completed int;
  name_txt text := nullif(trim(coalesce(_merchant_name, '')), '');
  region_txt text := nullif(trim(coalesce(_merchant_region, '')), '');
  snap jsonb;
  app public.p2p_merchant_applications;
  tier public.p2p_merchant_tier := 'verified';
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if _requested_tier = 'super' then
    raise exception 'Super Merchant is granted by admin. Apply as merchant first.';
  end if;

  select * into cur from public.p2p_merchants where user_id = uid;
  if cur.tier in ('verified', 'super') then
    raise exception 'You are already an approved merchant';
  end if;

  if exists (
    select 1 from public.p2p_merchant_applications
    where user_id = uid and status = 'pending'
  ) then
    raise exception 'You already have a pending application';
  end if;

  if name_txt is null or char_length(name_txt) < 2 then
    raise exception 'Enter your merchant display name';
  end if;
  if region_txt is null or char_length(region_txt) < 2 then
    raise exception 'Enter your region / country';
  end if;

  ousd_bal := public.p2p_merchant_p2p_ousd(uid);
  if ousd_bal < 100 then
    raise exception
      'Transfer at least 100 OUSD into your P2P account before applying (you have % OUSD)',
      round(ousd_bal, 2);
  end if;

  completed := public.p2p_merchant_completed_orders(uid);

  snap := jsonb_build_object(
    'merchant_name', name_txt,
    'merchant_region', region_txt,
    'p2p_ousd', ousd_bal,
    'min_ousd_required', 100,
    'completed_count', completed,
    'current_tier', coalesce(cur.tier::text, 'none'),
    'requested_at', now()
  );

  insert into public.p2p_merchant_applications (
    user_id, requested_tier, status, checklist_snapshot, applicant_note,
    merchant_name, merchant_region
  ) values (
    uid, tier, 'pending', snap,
    nullif(trim(coalesce(_note, '')), ''),
    name_txt, region_txt
  )
  returning * into app;

  return app;
end;
$function$;

CREATE OR REPLACE FUNCTION public.p2p_create_ad(_side p2p_ad_side, _asset text, _price_usd numeric, _total_amount numeric, _min_order numeric, _max_order numeric, _payment_methods text[], _pay_time_limit_minutes integer DEFAULT 15, _terms text DEFAULT NULL::text)
 RETURNS p2p_ads
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  bal numeric;
  reserved numeric;
  ad public.p2p_ads;
  missing text;
  wid uuid;
  asset_u text := upper(_asset);
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if not public.p2p_merchant_can_list(uid) then
    raise exception
      'Merchant approval required. Fund ≥100 OUSD in P2P, apply in P2P → Merchant, then wait for admin approval.';
  end if;

  if _price_usd <= 0 or _total_amount <= 0 then raise exception 'Invalid amount'; end if;
  if _min_order <= 0 or _max_order < _min_order then raise exception 'Invalid order limits'; end if;
  if _max_order > _total_amount then raise exception 'Max order cannot exceed total amount'; end if;
  if coalesce(array_length(_payment_methods, 1), 0) = 0 then
    raise exception 'Select at least one payment method';
  end if;
  if public.p2p_balance_column(asset_u) is null then
    raise exception 'Unsupported asset %', asset_u;
  end if;

  perform public.p2p_assert_trade_limit(asset_u, _total_amount, _price_usd, 'ad total');
  perform public.p2p_assert_trade_limit(asset_u, _max_order, _price_usd, 'max order');
  perform public.p2p_assert_trade_limit(asset_u, _min_order, _price_usd, 'min order');

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

    select id into wid
    from public.wallets
    where user_id = uid
    order by is_active desc, created_at asc
    limit 1;
    if wid is null then
      raise exception 'No wallet found — transfer funds into P2P first';
    end if;

    select coalesce(balance, 0) into bal
    from public.wallet_account_balances
    where wallet_id = wid and account = 'p2p' and asset = asset_u;
    bal := coalesce(bal, 0);

    select coalesce(sum(available_amount), 0) into reserved
    from public.p2p_ads
    where user_id = uid and side = 'sell' and status = 'active' and upper(asset) = asset_u;

    if bal - reserved < _total_amount then
      raise exception
        'Insufficient % in P2P account. Transfer from Funding first. Available for new ads: % (P2P % − reserved %).',
        asset_u,
        greatest(bal - reserved, 0),
        bal,
        reserved;
    end if;
  end if;

  insert into public.p2p_ads (
    user_id, side, asset, price_usd, total_amount, available_amount,
    min_order, max_order, payment_methods, pay_time_limit_minutes, terms
  ) values (
    uid, _side, asset_u, _price_usd, _total_amount, _total_amount,
    _min_order, _max_order, _payment_methods, _pay_time_limit_minutes, nullif(trim(_terms), '')
  )
  returning * into ad;
  return ad;
end;
$function$;