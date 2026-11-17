-- Community chats/comments: direct table reads limited to the author and staff.
-- Room feeds are served through authenticated server functions with limited columns and row counts.
DROP POLICY IF EXISTS global_chat_signed_in_read ON public.global_chat_messages;
CREATE POLICY global_chat_read_own_or_staff ON public.global_chat_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));

DROP POLICY IF EXISTS ot_comments_signed_in_read ON public.ot_comments;
CREATE POLICY ot_comments_read_own_or_staff ON public.ot_comments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));

DROP POLICY IF EXISTS ot_chat_signed_in_read ON public.ot_token_chat_messages;
CREATE POLICY ot_chat_read_own_or_staff ON public.ot_token_chat_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));

-- Orbit community feed: direct reads limited to the author's own posts and likes.
DROP POLICY IF EXISTS "posts readable by everyone" ON public.exchange_posts;
CREATE POLICY exchange_posts_read_own ON public.exchange_posts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes readable by everyone" ON public.exchange_post_likes;
CREATE POLICY exchange_post_likes_read_own ON public.exchange_post_likes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- P2P ratings: only the two trade parties and admins.
DROP POLICY IF EXISTS p2p_ratings_select_auth ON public.p2p_ratings;
CREATE POLICY p2p_ratings_select_party ON public.p2p_ratings
  FOR SELECT TO authenticated
  USING (rater_id = auth.uid() OR ratee_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- P2P merchant records (include admin notes): owner only; admins via existing admin policy.
DROP POLICY IF EXISTS p2p_merchants_select_all ON public.p2p_merchants;
CREATE POLICY p2p_merchants_select_own ON public.p2p_merchants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- NFT transfer history: only owners of the sending or receiving wallet.
DROP POLICY IF EXISTS nft_tx_public_select ON public.nft_transactions;
CREATE POLICY nft_tx_select_participant ON public.nft_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.wallets w
      WHERE w.user_id = auth.uid()
        AND (w.id = nft_transactions.from_wallet_id OR w.id = nft_transactions.to_wallet_id)
    )
  );

-- Platform configuration: read only by admins directly; the app serves the needed fields from server code.
DROP POLICY IF EXISTS scanner_targets_signed_in_read ON public.scanner_targets;
DROP POLICY IF EXISTS p2p_pm_signed_in_read ON public.p2p_payment_methods;
DROP POLICY IF EXISTS "Signed-in users can view topup methods" ON public.topup_methods;
DROP POLICY IF EXISTS topup_settings_read ON public.topup_settings;
DROP POLICY IF EXISTS feature_flags_public_read ON public.feature_flags;
DROP POLICY IF EXISTS "Anyone can view auth methods" ON public.auth_methods;

-- Uploaded media: readers use signed links; direct listing/reading limited to the file owner.
DROP POLICY IF EXISTS media_authenticated_read ON storage.objects;