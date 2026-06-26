
DROP POLICY IF EXISTS "Public can view A2U transaction history" ON public.pi_a2u_transactions;
DROP POLICY IF EXISTS "Public can view A2U wallet progress" ON public.pi_a2u_wallets;

REVOKE SELECT ON public.pi_a2u_transactions FROM anon, authenticated;
REVOKE SELECT ON public.pi_a2u_wallets FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
