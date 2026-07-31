-- OUSD withdrawals: lock/debit user balance → @openpay treasury, admin approve/reject.

CREATE TABLE IF NOT EXISTS public.ousd_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  amount NUMERIC(18, 8) NOT NULL CHECK (amount >= 10),
  destination_address TEXT NOT NULL,
  display_name TEXT,
  username TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'rejected', 'cancelled')),
  treasury_address TEXT NOT NULL DEFAULT '0x30d908ac9df497fbe1934c47c0a90cb38107985d',
  treasury_wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  admin_note TEXT,
  payout_tx_hash TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ousd_withdrawals_user_id_idx
  ON public.ousd_withdrawals (user_id);

CREATE INDEX IF NOT EXISTS ousd_withdrawals_status_idx
  ON public.ousd_withdrawals (status);

CREATE INDEX IF NOT EXISTS ousd_withdrawals_created_at_idx
  ON public.ousd_withdrawals (created_at DESC);

ALTER TABLE public.ousd_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ousd_withdrawals_owner_select"
  ON public.ousd_withdrawals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ousd_withdrawals_service_all"
  ON public.ousd_withdrawals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT ON public.ousd_withdrawals TO authenticated;
GRANT ALL ON public.ousd_withdrawals TO service_role;

COMMENT ON TABLE public.ousd_withdrawals IS
  'OUSD cash-out requests. Amount locked (debited) on create and credited to @openpay treasury; admin completes off-chain payout or rejects/refunds.';
