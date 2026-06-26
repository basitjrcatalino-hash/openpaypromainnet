DROP POLICY IF EXISTS nft_tx_owner_insert ON public.nft_transactions;

CREATE POLICY nft_tx_owner_insert ON public.nft_transactions
FOR INSERT TO authenticated
WITH CHECK (
  (from_wallet_id IS NOT NULL OR to_wallet_id IS NOT NULL)
  AND (
    from_wallet_id IS NULL OR EXISTS (
      SELECT 1 FROM public.wallets w
      WHERE w.id = from_wallet_id AND w.user_id = auth.uid()
    )
  )
  AND (
    to_wallet_id IS NULL OR EXISTS (
      SELECT 1 FROM public.wallets w
      WHERE w.id = to_wallet_id AND w.user_id = auth.uid()
    )
  )
  AND (
    EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = from_wallet_id AND w.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = to_wallet_id AND w.user_id = auth.uid())
  )
);