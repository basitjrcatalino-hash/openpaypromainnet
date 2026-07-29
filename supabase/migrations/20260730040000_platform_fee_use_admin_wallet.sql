-- Prefer admin Top-up Settings fee_wallet_address (0x… or @username),
-- then hardcoded treasury address, then profile @openpay.

CREATE OR REPLACE FUNCTION public.credit_platform_fee_ousd(
  p_amount NUMERIC,
  p_memo TEXT DEFAULT 'Platform fee',
  p_source_wallet_id UUID DEFAULT NULL,
  p_counterparty TEXT DEFAULT 'platform_fee'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  treasury_id UUID;
  fee_amt NUMERIC := ROUND(COALESCE(p_amount, 0), 8);
  configured TEXT;
  handle TEXT;
BEGIN
  IF fee_amt <= 0 THEN
    RETURN NULL;
  END IF;

  -- 1) Admin-configured fee wallet (topup_settings)
  SELECT NULLIF(trim(fee_wallet_address), '') INTO configured
  FROM public.topup_settings
  WHERE id = 1;

  IF configured IS NOT NULL THEN
    IF lower(configured) LIKE '0x%' THEN
      SELECT w.id INTO treasury_id
      FROM public.wallets w
      WHERE lower(w.address) = lower(configured)
      LIMIT 1;
    ELSE
      handle := lower(ltrim(configured, '@'));
      SELECT w.id INTO treasury_id
      FROM public.wallets w
      JOIN public.profiles p ON p.id = w.user_id
      WHERE lower(p.username) = handle
      ORDER BY w.is_active DESC NULLS LAST, w.created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  -- 2) Hardcoded OpenPay Pro treasury address
  IF treasury_id IS NULL THEN
    SELECT w.id INTO treasury_id
    FROM public.wallets w
    WHERE lower(w.address) = lower('0xc847682465ea537c3957cd46eff2c7229faefde1')
    LIMIT 1;
  END IF;

  -- 3) Profile username @openpay
  IF treasury_id IS NULL THEN
    SELECT w.id INTO treasury_id
    FROM public.wallets w
    JOIN public.profiles p ON p.id = w.user_id
    WHERE lower(p.username) = lower('openpay')
    ORDER BY w.is_active DESC NULLS LAST, w.created_at ASC
    LIMIT 1;
  END IF;

  IF treasury_id IS NULL THEN
    RAISE WARNING 'Platform fee treasury wallet not found (fee_wallet_address / @openpay / 0xc847…fde1); fee % not credited', fee_amt;
    RETURN NULL;
  END IF;

  UPDATE public.wallets
  SET ousd_balance = COALESCE(ousd_balance, 0) + fee_amt
  WHERE id = treasury_id;

  INSERT INTO public.transactions (
    wallet_id, type, status, token_symbol, counterparty, amount, usd_value, memo
  )
  VALUES (
    treasury_id,
    'receive',
    'confirmed',
    'OUSD',
    COALESCE(p_counterparty, COALESCE(p_source_wallet_id::text, 'platform_fee')),
    fee_amt,
    fee_amt,
    p_memo
  );

  RETURN treasury_id;
END;
$$;
