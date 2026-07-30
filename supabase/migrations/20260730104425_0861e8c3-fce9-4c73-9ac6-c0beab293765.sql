-- 1. Pin search_path on email queue helpers
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq, pg_catalog;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq, pg_catalog;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq, pg_catalog;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq, pg_catalog;

-- 2. Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated/PUBLIC
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_platform_fee_ousd(numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ot_bump_report_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ot_refresh_change_24h() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backfill_ledger_entries() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ot_execute_trade(uuid, uuid, ot_trade_side, numeric, numeric) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_platform_fee_ousd(numeric, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_ledger_entries() TO service_role;
GRANT EXECUTE ON FUNCTION public.ot_execute_trade(uuid, uuid, ot_trade_side, numeric, numeric) TO authenticated, service_role;

-- 3. Explicit admin read policies for Pi A2U tables
DROP POLICY IF EXISTS "pi_a2u_transactions_admin_select" ON public.pi_a2u_transactions;
CREATE POLICY "pi_a2u_transactions_admin_select"
ON public.pi_a2u_transactions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "pi_a2u_wallets_admin_select" ON public.pi_a2u_wallets;
CREATE POLICY "pi_a2u_wallets_admin_select"
ON public.pi_a2u_wallets
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));