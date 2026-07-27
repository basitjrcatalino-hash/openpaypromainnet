-- OpenToken trades debit/credit wallet OUSD instead of Pi balance (1 OUSD = 1 unit on curve).
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
  graduated BOOLEAN := false;
  cd TIMESTAMPTZ;
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
  IF tok.status = 'graduated' THEN
    RAISE EXCEPTION 'Token graduated — use OpenDEX (coming soon)';
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
    pi_in := p_pi_amount;
    IF wal.ousd_balance < pi_in THEN
      RAISE EXCEPTION 'Insufficient OUSD balance';
    END IF;
    new_v_pi := v_pi + pi_in;
    new_v_tok := k / new_v_pi;
    tok_out := v_tok - new_v_tok;
    IF tok_out <= 0 THEN
      RAISE EXCEPTION 'Trade too small';
    END IF;
    price := pi_in / tok_out;

    UPDATE public.wallets SET ousd_balance = ousd_balance - pi_in WHERE id = wal.id;
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

    INSERT INTO public.ot_trades (token_id, user_id, wallet_id, side, pi_amount, token_amount, price, tx_ref)
    VALUES (tok.id, uid, wal.id, 'buy', pi_in, tok_out, price, 'ot_' || replace(gen_random_uuid()::text, '-', ''));

    INSERT INTO public.ot_price_ticks (token_id, price, market_cap)
    VALUES (tok.id, price, price * tok.total_supply);

    SELECT curve_reserve_pi INTO pi_out FROM public.tokens WHERE id = tok.id;
    IF pi_out >= tok.graduation_target_pi THEN
      UPDATE public.tokens SET status = 'graduated', graduated_at = now() WHERE id = tok.id;
      graduated := true;
    END IF;

    INSERT INTO public.ot_trade_cooldown (user_id, last_trade_at)
    VALUES (uid, now())
    ON CONFLICT (user_id) DO UPDATE SET last_trade_at = now();

    RETURN jsonb_build_object(
      'side', 'buy',
      'pi_amount', pi_in,
      'token_amount', tok_out,
      'price', price,
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
    pi_out := v_pi - new_v_pi;
    IF pi_out <= 0 OR pi_out > tok.curve_reserve_pi THEN
      RAISE EXCEPTION 'Insufficient curve liquidity';
    END IF;
    price := pi_out / tok_in;

    UPDATE public.token_holdings
      SET balance = balance - tok_in, updated_at = now()
      WHERE id = hold.id;
    UPDATE public.wallets SET ousd_balance = ousd_balance + pi_out WHERE id = wal.id;

    UPDATE public.tokens SET
      curve_reserve_pi = curve_reserve_pi - pi_out,
      curve_supply_sold = GREATEST(0, curve_supply_sold - tok_in),
      price_usd = price,
      market_cap = price * total_supply,
      volume_24h = volume_24h + pi_out,
      holder_count = (
        SELECT COUNT(*) FROM public.token_holdings
        WHERE token_id = tok.id AND balance > 0
      )
    WHERE id = tok.id;

    INSERT INTO public.ot_trades (token_id, user_id, wallet_id, side, pi_amount, token_amount, price, tx_ref)
    VALUES (tok.id, uid, wal.id, 'sell', pi_out, tok_in, price, 'ot_' || replace(gen_random_uuid()::text, '-', ''));

    INSERT INTO public.ot_price_ticks (token_id, price, market_cap)
    VALUES (tok.id, price, price * tok.total_supply);

    INSERT INTO public.ot_trade_cooldown (user_id, last_trade_at)
    VALUES (uid, now())
    ON CONFLICT (user_id) DO UPDATE SET last_trade_at = now();

    RETURN jsonb_build_object(
      'side', 'sell',
      'pi_amount', pi_out,
      'token_amount', tok_in,
      'price', price,
      'graduated', false
    );
  END IF;
END;
$$;
