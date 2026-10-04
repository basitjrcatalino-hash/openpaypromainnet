DROP POLICY IF EXISTS acm_select ON public.asset_chat_messages;
CREATE POLICY acm_select ON public.asset_chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS ot_follows_read ON public.ot_follows;
CREATE POLICY ot_follows_read ON public.ot_follows FOR SELECT TO authenticated USING (auth.uid() = follower_id OR auth.uid() = creator_id);
DROP POLICY IF EXISTS media_anon_read ON storage.objects;
CREATE POLICY media_owner_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'media' AND owner_id = (select auth.uid()::text));