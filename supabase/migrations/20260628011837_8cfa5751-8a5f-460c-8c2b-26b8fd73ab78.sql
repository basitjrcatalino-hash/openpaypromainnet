
-- 1) SECURITY DEFINER function execution permissions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- 2) pi_a2u_transactions / pi_a2u_wallets — owner-only SELECT
GRANT SELECT ON public.pi_a2u_transactions TO authenticated;
GRANT SELECT ON public.pi_a2u_wallets TO authenticated;

DROP POLICY IF EXISTS "pi_a2u_tx_owner_select" ON public.pi_a2u_transactions;
CREATE POLICY "pi_a2u_tx_owner_select"
  ON public.pi_a2u_transactions FOR SELECT
  TO authenticated
  USING (uid = (auth.uid())::text);

DROP POLICY IF EXISTS "pi_a2u_wallets_owner_select" ON public.pi_a2u_wallets;
CREATE POLICY "pi_a2u_wallets_owner_select"
  ON public.pi_a2u_wallets FOR SELECT
  TO authenticated
  USING (uid = (auth.uid())::text);

-- 3) Profiles: drop broad authenticated read; keep self-select only.
-- Username resolution for sends still works via the admin client server-side.
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

-- 4) Protect pin_hash in user_preferences via column-level revoke.
-- Provide a SECURITY DEFINER helper so the client can check existence
-- without ever reading the hash itself.
REVOKE SELECT (pin_hash) ON public.user_preferences FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_user_pin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_preferences
    WHERE user_id = auth.uid() AND pin_hash IS NOT NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_user_pin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_user_pin() TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_user_pin(_pin_hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_preferences
    WHERE user_id = auth.uid() AND pin_hash = _pin_hash
  );
$$;

REVOKE EXECUTE ON FUNCTION public.verify_user_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_user_pin(text) TO authenticated;
