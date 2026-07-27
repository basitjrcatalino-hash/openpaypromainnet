-- OpenToken launchpad: bonding curve fields + related tables

-- Token categories / status
DO $$ BEGIN
  CREATE TYPE public.ot_token_category AS ENUM (
    'meme', 'ai', 'gaming', 'utility', 'defi', 'nft', 'community'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ot_token_status AS ENUM ('curve', 'graduated', 'halted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ot_trade_side AS ENUM ('buy', 'sell');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ot_report_status AS ENUM ('open', 'reviewed', 'dismissed', 'actioned');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend tokens for OpenToken launchpad
ALTER TABLE public.tokens
  ADD COLUMN IF NOT EXISTS category public.ot_token_category DEFAULT 'meme',
  ADD COLUMN IF NOT EXISTS discord TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS status public.ot_token_status NOT NULL DEFAULT 'curve',
  ADD COLUMN IF NOT EXISTS curve_supply_sold NUMERIC(38,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS curve_reserve_pi NUMERIC(38,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS curve_virtual_pi NUMERIC(38,8) NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS curve_virtual_tokens NUMERIC(38,8) NOT NULL DEFAULT 1073000191,
  ADD COLUMN IF NOT EXISTS graduation_target_pi NUMERIC(38,8) NOT NULL DEFAULT 400,
  ADD COLUMN IF NOT EXISTS graduated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS holder_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS launch_fee_pi NUMERIC(38,8) NOT NULL DEFAULT 0.1;

CREATE INDEX IF NOT EXISTS tokens_status_idx ON public.tokens(status);
CREATE INDEX IF NOT EXISTS tokens_category_idx ON public.tokens(category);
CREATE INDEX IF NOT EXISTS tokens_volume_idx ON public.tokens(volume_24h DESC);
CREATE INDEX IF NOT EXISTS tokens_created_idx ON public.tokens(created_at DESC);

-- Admin can update any token (feature/hide/verify)
DROP POLICY IF EXISTS tokens_admin_update ON public.tokens;
CREATE POLICY tokens_admin_update ON public.tokens
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- Trades
CREATE TABLE IF NOT EXISTS public.ot_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  side public.ot_trade_side NOT NULL,
  pi_amount NUMERIC(38,8) NOT NULL,
  token_amount NUMERIC(38,8) NOT NULL,
  price NUMERIC(38,18) NOT NULL,
  tx_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ot_trades_token_idx ON public.ot_trades(token_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ot_trades_user_idx ON public.ot_trades(user_id, created_at DESC);
GRANT SELECT ON public.ot_trades TO anon, authenticated;
GRANT INSERT ON public.ot_trades TO authenticated;
GRANT ALL ON public.ot_trades TO service_role;
ALTER TABLE public.ot_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ot_trades_public_read ON public.ot_trades;
CREATE POLICY ot_trades_public_read ON public.ot_trades FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS ot_trades_insert_own ON public.ot_trades;
CREATE POLICY ot_trades_insert_own ON public.ot_trades FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Comments
CREATE TABLE IF NOT EXISTS public.ot_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ot_comments_token_idx ON public.ot_comments(token_id, created_at DESC);
GRANT SELECT ON public.ot_comments TO anon, authenticated;
GRANT INSERT, DELETE ON public.ot_comments TO authenticated;
GRANT ALL ON public.ot_comments TO service_role;
ALTER TABLE public.ot_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ot_comments_public_read ON public.ot_comments;
CREATE POLICY ot_comments_public_read ON public.ot_comments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS ot_comments_insert_own ON public.ot_comments;
CREATE POLICY ot_comments_insert_own ON public.ot_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS ot_comments_delete_own ON public.ot_comments;
CREATE POLICY ot_comments_delete_own ON public.ot_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- Favorites
CREATE TABLE IF NOT EXISTS public.ot_favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, token_id)
);
GRANT SELECT, INSERT, DELETE ON public.ot_favorites TO authenticated;
GRANT ALL ON public.ot_favorites TO service_role;
ALTER TABLE public.ot_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ot_favorites_own ON public.ot_favorites;
CREATE POLICY ot_favorites_own ON public.ot_favorites FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Follows
CREATE TABLE IF NOT EXISTS public.ot_follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, creator_id),
  CHECK (follower_id <> creator_id)
);
GRANT SELECT, INSERT, DELETE ON public.ot_follows TO authenticated;
GRANT SELECT ON public.ot_follows TO anon;
GRANT ALL ON public.ot_follows TO service_role;
ALTER TABLE public.ot_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ot_follows_read ON public.ot_follows;
CREATE POLICY ot_follows_read ON public.ot_follows FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS ot_follows_own ON public.ot_follows;
CREATE POLICY ot_follows_own ON public.ot_follows FOR ALL TO authenticated
  USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

-- Reports
CREATE TABLE IF NOT EXISTS public.ot_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  status public.ot_report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ot_reports_status_idx ON public.ot_reports(status, created_at DESC);
GRANT SELECT, INSERT ON public.ot_reports TO authenticated;
GRANT UPDATE ON public.ot_reports TO authenticated;
GRANT ALL ON public.ot_reports TO service_role;
ALTER TABLE public.ot_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ot_reports_insert ON public.ot_reports;
CREATE POLICY ot_reports_insert ON public.ot_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS ot_reports_read ON public.ot_reports;
CREATE POLICY ot_reports_read ON public.ot_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
DROP POLICY IF EXISTS ot_reports_admin_update ON public.ot_reports;
CREATE POLICY ot_reports_admin_update ON public.ot_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- Notifications
CREATE TABLE IF NOT EXISTS public.ot_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  href TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ot_notifications_user_idx ON public.ot_notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.ot_notifications TO authenticated;
GRANT ALL ON public.ot_notifications TO service_role;
ALTER TABLE public.ot_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ot_notifications_own ON public.ot_notifications;
CREATE POLICY ot_notifications_own ON public.ot_notifications FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Price ticks for charts
CREATE TABLE IF NOT EXISTS public.ot_price_ticks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  price NUMERIC(38,18) NOT NULL,
  market_cap NUMERIC(38,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ot_price_ticks_token_idx ON public.ot_price_ticks(token_id, created_at DESC);
GRANT SELECT ON public.ot_price_ticks TO anon, authenticated;
GRANT ALL ON public.ot_price_ticks TO service_role;
ALTER TABLE public.ot_price_ticks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ot_price_ticks_read ON public.ot_price_ticks;
CREATE POLICY ot_price_ticks_read ON public.ot_price_ticks FOR SELECT TO anon, authenticated USING (true);

-- Rate-limit helper: last trade timestamp per user
CREATE TABLE IF NOT EXISTS public.ot_trade_cooldown (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_trade_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.ot_trade_cooldown TO service_role;
ALTER TABLE public.ot_trade_cooldown ENABLE ROW LEVEL SECURITY;

-- Atomic trade execution (service role / security definer)
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

  -- 1.5s cooldown
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
    IF wal.pi_balance < pi_in THEN
      RAISE EXCEPTION 'Insufficient Pi balance';
    END IF;
    new_v_pi := v_pi + pi_in;
    new_v_tok := k / new_v_pi;
    tok_out := v_tok - new_v_tok;
    IF tok_out <= 0 THEN
      RAISE EXCEPTION 'Trade too small';
    END IF;
    price := pi_in / tok_out;

    UPDATE public.wallets SET pi_balance = pi_balance - pi_in WHERE id = wal.id;
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

    -- graduation check
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
    -- sell
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
    UPDATE public.wallets SET pi_balance = pi_balance + pi_out WHERE id = wal.id;

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

REVOKE ALL ON FUNCTION public.ot_execute_trade FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ot_execute_trade TO authenticated;

-- Increment report count trigger
CREATE OR REPLACE FUNCTION public.ot_bump_report_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tokens SET report_count = report_count + 1 WHERE id = NEW.token_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ot_reports_bump ON public.ot_reports;
CREATE TRIGGER ot_reports_bump
  AFTER INSERT ON public.ot_reports
  FOR EACH ROW EXECUTE FUNCTION public.ot_bump_report_count();
