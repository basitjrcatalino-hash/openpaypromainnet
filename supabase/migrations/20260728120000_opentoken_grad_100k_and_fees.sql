-- OpenToken: enforce 100k OUSD graduation, repair premature graduates, add 0.30% trade fee.

ALTER TABLE public.tokens
  ALTER COLUMN graduation_target_pi SET DEFAULT 100000;

UPDATE public.tokens
SET graduation_target_pi = 100000
WHERE graduation_target_pi IS NULL
   OR graduation_target_pi <= 0
   OR graduation_target_pi = 400;

-- Tokens that only hit the legacy 400 OUSD bar are not truly graduated.
UPDATE public.tokens
SET status = 'curve',
    graduated_at = NULL
WHERE status = 'graduated'
  AND COALESCE(curve_reserve_pi, 0) < 100000;

CREATE OR REPLACE FUNCTION public.ot_execute_trade(
  p_token_id UUID,
  p_wallet_id UUID,
  p_side public.ot_trade_side,
  p_pi_amount NUMERIC DEFAULT NULL,
  p_token_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  tok RECORD;
  wal RECORD;
  hold RECORD;
  v_pi NUMERIC;
  v_tok NUMERIC;
  k NUMERIC;
  pi_in NUMERIC;
  pi_out NUMERIC;
  tok_out NUMERIC;
  tok_in NUMERIC;
  new_v_pi NUMERIC;
  new_v_tok NUMERIC;
  price NUMERIC;
  fee NUMERIC := 0;
  fee_bps NUMERIC := 30; -- 0.30% platform fee (matches OpenDEX)
  gross NUMERIC;
  net NUMERIC;
  graduated BOOLEAN := false;
  cd TIMESTAMPTZ;
  v_tx_ref TEXT;
  grad_target NUMERIC;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT last_trade_at INTO cd FROM public.ot_trade_cooldown WHERE user_id = uid;
  IF cd IS NOT NULL AND cd > now() - interval '1.5 seconds' THEN
    RAISE EXCEPTION 'Please wait before trading again';
  END IF;

  SELECT * INTO wal FROM public.wallets WHERE id = p_wallet_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  SELECT * INTO tok FROM public.tokens WHERE id = p_token_id AND COALESCE(is_hidden, false) = false FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token not found';
  END IF;
  IF tok.status = 'halted' THEN
    RAISE EXCEPTION 'Trading halted';
  END IF;

  -- Effective graduation target: never below 100,000 OUSD (legacy rows used 400).
  grad_target := COALESCE(tok.graduation_target_pi, 100000);
  IF grad_target <= 0 OR grad_target = 400 THEN
    grad_target := 100000;
  END IF;
  IF tok.graduation_target_pi IS DISTINCT FROM grad_target THEN
    UPDATE public.tokens SET graduation_target_pi = grad_target WHERE id = tok.id;
    tok.graduation_target_pi := grad_target;
  END IF;

  -- Premature "graduated" (reserve below 100k) stays on OpenToken bonding curve.
  IF tok.status = 'graduated' AND COALESCE(tok.curve_reserve_pi, 0) < grad_target THEN
    UPDATE public.tokens SET status = 'curve', graduated_at = NULL WHERE id = tok.id;
    tok.status := 'curve';
  END IF;

  IF tok.status = 'graduated' THEN
    RAISE EXCEPTION 'Token graduated — use OpenDEX';
  END IF;

  v_pi := tok.curve_virtual_pi + tok.curve_reserve_pi;
  v_tok := tok.curve_virtual_tokens - tok.curve_supply_sold;
  IF v_tok <= 0 OR v_pi <= 0 THEN
    RAISE EXCEPTION 'Invalid curve state';
  END IF;
  k := v_pi * v_tok;

  IF p_side = 'buy' THEN
    IF p_pi_amount IS NULL OR p_pi_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid buy amount';
    END IF;
    gross := p_pi_amount;
    fee := ROUND(gross * fee_bps / 10000.0, 8);
    pi_in := gross - fee;
    IF pi_in <= 0 THEN
      RAISE EXCEPTION 'Trade too small after fee';
    END IF;
    IF wal.ousd_balance < gross THEN
      RAISE EXCEPTION 'Insufficient OUSD balance';
    END IF;
    new_v_pi := v_pi + pi_in;
    new_v_tok := k / new_v_pi;
    tok_out := v_tok - new_v_tok;
    IF tok_out <= 0 THEN
      RAISE EXCEPTION 'Trade too small';
    END IF;
    price := pi_in / tok_out;

    UPDATE public.wallets SET ousd_balance = ousd_balance - gross WHERE id = wal.id;
    INSERT INTO public.token_holdings (wallet_id, token_id, balance, updated_at)
    VALUES (wal.id, tok.id, tok_out, now())
    ON CONFLICT (wallet_id, token_id)
    DO UPDATE SET balance = public.token_holdings.balance + EXCLUDED.balance, updated_at = now();

    UPDATE public.tokens SET
      curve_reserve_pi = curve_reserve_pi + pi_in,
      curve_supply_sold = curve_supply_sold + tok_out,
      price_usd = price,
      market_cap = price * total_supply,
      volume_24h = volume_24h + pi_in,
      holder_count = (
        SELECT COUNT(*) FROM public.token_holdings
        WHERE token_id = tok.id AND balance > 0
      )
    WHERE id = tok.id;

    v_tx_ref := 'ot_' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.ot_trades (token_id, user_id, wallet_id, side, pi_amount, token_amount, price, tx_ref)
    VALUES (tok.id, uid, wal.id, 'buy', gross, tok_out, price, v_tx_ref);

    INSERT INTO public.transactions (
      wallet_id, type, status, token_id, token_symbol, amount, usd_value, counterparty, memo, tx_hash
    )
    VALUES (
      wal.id,
      'buy',
      'confirmed',
      tok.id,
      '$' || tok.symbol,
      tok_out,
      gross,
      'OpenToken',
      'OpenToken buy ' || tok_out::text || ' $' || tok.symbol || ' for ' || gross::text ||
        ' OUSD (fee ' || fee::text || ')',
      v_tx_ref
    );

    INSERT INTO public.ot_price_ticks (token_id, price, market_cap)
    VALUES (tok.id, price, price * tok.total_supply);

    SELECT curve_reserve_pi INTO pi_out FROM public.tokens WHERE id = tok.id;
    IF pi_out >= grad_target THEN
      UPDATE public.tokens
      SET status = 'graduated', graduated_at = now(), graduation_target_pi = grad_target
      WHERE id = tok.id;
      graduated := true;
    END IF;

    INSERT INTO public.ot_trade_cooldown (user_id, last_trade_at)
    VALUES (uid, now())
    ON CONFLICT (user_id) DO UPDATE SET last_trade_at = now();

    RETURN jsonb_build_object(
      'side', 'buy',
      'pi_amount', gross,
      'net_pi_amount', pi_in,
      'token_amount', tok_out,
      'price', price,
      'fee', fee,
      'fee_bps', fee_bps,
      'graduated', graduated
    );
  ELSE
    IF p_token_amount IS NULL OR p_token_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid sell amount';
    END IF;
    tok_in := p_token_amount;
    SELECT * INTO hold FROM public.token_holdings
      WHERE wallet_id = wal.id AND token_id = tok.id FOR UPDATE;
    IF NOT FOUND OR hold.balance < tok_in THEN
      RAISE EXCEPTION 'Insufficient token balance';
    END IF;

    new_v_tok := v_tok + tok_in;
    new_v_pi := k / new_v_tok;
    gross := v_pi - new_v_pi;
    IF gross <= 0 OR gross > tok.curve_reserve_pi THEN
      RAISE EXCEPTION 'Insufficient curve liquidity';
    END IF;
    fee := ROUND(gross * fee_bps / 10000.0, 8);
    net := gross - fee;
    IF net <= 0 THEN
      RAISE EXCEPTION 'Trade too small after fee';
    END IF;
    price := gross / tok_in;

    UPDATE public.token_holdings
      SET balance = balance - tok_in, updated_at = now()
      WHERE id = hold.id;
    UPDATE public.wallets SET ousd_balance = ousd_balance + net WHERE id = wal.id;

    UPDATE public.tokens SET
      curve_reserve_pi = curve_reserve_pi - gross,
      curve_supply_sold = GREATEST(0, curve_supply_sold - tok_in),
      price_usd = price,
      market_cap = price * total_supply,
      volume_24h = volume_24h + gross,
      holder_count = (
        SELECT COUNT(*) FROM public.token_holdings
        WHERE token_id = tok.id AND balance > 0
      )
    WHERE id = tok.id;

    v_tx_ref := 'ot_' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.ot_trades (token_id, user_id, wallet_id, side, pi_amount, token_amount, price, tx_ref)
    VALUES (tok.id, uid, wal.id, 'sell', net, tok_in, price, v_tx_ref);

    INSERT INTO public.transactions (
      wallet_id, type, status, token_id, token_symbol, amount, usd_value, counterparty, memo, tx_hash
    )
    VALUES (
      wal.id,
      'sell',
      'confirmed',
      tok.id,
      '$' || tok.symbol,
      tok_in,
      net,
      'OpenToken',
      'OpenToken sell ' || tok_in::text || ' $' || tok.symbol || ' for ' || net::text ||
        ' OUSD (fee ' || fee::text || ')',
      v_tx_ref
    );

    INSERT INTO public.ot_price_ticks (token_id, price, market_cap)
    VALUES (tok.id, price, price * tok.total_supply);

    INSERT INTO public.ot_trade_cooldown (user_id, last_trade_at)
    VALUES (uid, now())
    ON CONFLICT (user_id) DO UPDATE SET last_trade_at = now();

    RETURN jsonb_build_object(
      'side', 'sell',
      'pi_amount', net,
      'gross_pi_amount', gross,
      'token_amount', tok_in,
      'price', price,
      'fee', fee,
      'fee_bps', fee_bps,
      'graduated', false
    );
  END IF;
END;
$$;
