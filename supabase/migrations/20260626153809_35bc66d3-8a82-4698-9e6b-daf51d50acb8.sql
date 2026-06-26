CREATE TABLE IF NOT EXISTS public.pi_a2u_transactions (
  id BIGSERIAL PRIMARY KEY,
  uid TEXT NOT NULL,
  username TEXT,
  payment_id TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0.01,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  txid TEXT,
  wallet_address TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pi_a2u_wallets (
  id BIGSERIAL PRIMARY KEY,
  uid TEXT NOT NULL,
  username TEXT,
  wallet_address TEXT NOT NULL,
  payment_id TEXT,
  txid TEXT,
  amount NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_a2u_wallets_address ON public.pi_a2u_wallets(wallet_address);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_a2u_wallets_payment_id ON public.pi_a2u_wallets(payment_id) WHERE payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_a2u_tx_success_uid ON public.pi_a2u_transactions(uid) WHERE status = 'success';
CREATE INDEX IF NOT EXISTS idx_pi_a2u_tx_payment_id ON public.pi_a2u_transactions(payment_id);

GRANT SELECT ON public.pi_a2u_transactions TO anon, authenticated;
GRANT ALL ON public.pi_a2u_transactions TO service_role;
GRANT SELECT ON public.pi_a2u_wallets TO anon, authenticated;
GRANT ALL ON public.pi_a2u_wallets TO service_role;

ALTER TABLE public.pi_a2u_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pi_a2u_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view A2U transaction history"
  ON public.pi_a2u_transactions FOR SELECT USING (true);

CREATE POLICY "Public can view A2U wallet progress"
  ON public.pi_a2u_wallets FOR SELECT USING (true);

CREATE TRIGGER pi_a2u_transactions_set_updated_at
  BEFORE UPDATE ON public.pi_a2u_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();