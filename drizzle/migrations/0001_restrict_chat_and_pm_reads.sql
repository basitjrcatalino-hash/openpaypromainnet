DROP POLICY IF EXISTS "ot_chat_public_read" ON public.ot_token_chat_messages;
CREATE POLICY "ot_chat_signed_in_read" ON public.ot_token_chat_messages FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "p2p_pm_read" ON public.p2p_payment_methods;
CREATE POLICY "p2p_pm_signed_in_read" ON public.p2p_payment_methods FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);