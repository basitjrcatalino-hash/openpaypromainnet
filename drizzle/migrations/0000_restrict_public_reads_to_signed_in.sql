DROP POLICY IF EXISTS "global_chat_public_read" ON public.global_chat_messages;
CREATE POLICY "global_chat_signed_in_read" ON public.global_chat_messages FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ot_comments_public_read" ON public.ot_comments;
CREATE POLICY "ot_comments_signed_in_read" ON public.ot_comments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "scanner_targets_public_read" ON public.scanner_targets;
CREATE POLICY "scanner_targets_signed_in_read" ON public.scanner_targets FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);