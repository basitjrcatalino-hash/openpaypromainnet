-- Circle Mint payment intents (stablecoin payins → OUSD top-up)
CREATE TABLE IF NOT EXISTS public.circle_mint_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  payment_intent_id TEXT NOT NULL,
  expected_amount NUMERIC(18, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  chain TEXT NOT NULL DEFAULT 'ETH',
  deposit_address TEXT,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'pending', 'paid', 'expired', 'failed', 'credited')),
  circle_payment_id TEXT,
  tx_hash TEXT,
  raw_intent JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_intent_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS circle_mint_deposits_payment_id_unique
  ON public.circle_mint_deposits (circle_payment_id)
  WHERE circle_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS circle_mint_deposits_user_id_idx
  ON public.circle_mint_deposits (user_id);

CREATE INDEX IF NOT EXISTS circle_mint_deposits_status_idx
  ON public.circle_mint_deposits (status);

ALTER TABLE public.circle_mint_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "circle_mint_deposits_owner_select"
  ON public.circle_mint_deposits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "circle_mint_deposits_service_all"
  ON public.circle_mint_deposits FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT ON public.circle_mint_deposits TO authenticated;
GRANT ALL ON public.circle_mint_deposits TO service_role;

COMMENT ON TABLE public.circle_mint_deposits IS
  'Circle Mint payment intents for USDC/EURC payins credited as OUSD. Reconcile via GET /v1/payments.';
