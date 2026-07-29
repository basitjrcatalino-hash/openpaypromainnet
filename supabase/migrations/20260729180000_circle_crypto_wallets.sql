-- Circle / multi-provider crypto wallets (separate from OpenPay ledger `wallets`)
-- provider abstraction: circle | dynamic | privy | turnkey | fireblocks | bitgo | coinbase

CREATE TABLE IF NOT EXISTS public.crypto_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'circle',
  circle_wallet_id TEXT,
  wallet_set_id TEXT,
  blockchain TEXT NOT NULL DEFAULT 'ETH-SEPOLIA',
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'creating', 'failed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, circle_wallet_id),
  UNIQUE (user_id, provider, blockchain)
);

CREATE INDEX IF NOT EXISTS crypto_wallets_user_id_idx ON public.crypto_wallets(user_id);
CREATE INDEX IF NOT EXISTS crypto_wallets_address_idx ON public.crypto_wallets(address);

ALTER TABLE public.crypto_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crypto_wallets_owner_select"
  ON public.crypto_wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Writes go through service role (server) only
CREATE POLICY "crypto_wallets_service_all"
  ON public.crypto_wallets FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT ON public.crypto_wallets TO authenticated;
GRANT ALL ON public.crypto_wallets TO service_role;

-- Crypto deposits / withdrawals (Circle + future providers)
CREATE TABLE IF NOT EXISTS public.crypto_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.crypto_wallets(id) ON DELETE CASCADE,
  tx_hash TEXT,
  token TEXT NOT NULL DEFAULT 'NATIVE',
  amount NUMERIC(38, 18) NOT NULL DEFAULT 0,
  network TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  direction TEXT NOT NULL CHECK (direction IN ('deposit', 'withdraw')),
  provider_tx_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_tx_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS crypto_transactions_tx_hash_unique
  ON public.crypto_transactions (tx_hash)
  WHERE tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS crypto_transactions_user_id_idx ON public.crypto_transactions(user_id);
CREATE INDEX IF NOT EXISTS crypto_transactions_wallet_id_idx ON public.crypto_transactions(wallet_id);

ALTER TABLE public.crypto_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crypto_transactions_owner_select"
  ON public.crypto_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "crypto_transactions_service_all"
  ON public.crypto_transactions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT ON public.crypto_transactions TO authenticated;
GRANT ALL ON public.crypto_transactions TO service_role;

COMMENT ON TABLE public.crypto_wallets IS
  'Provider-backed crypto wallets (Circle Programmable Wallets). Separate from OpenPay ledger wallets.';
COMMENT ON TABLE public.crypto_transactions IS
  'On-chain deposits/withdrawals for crypto_wallets. Deduped by provider_tx_id / tx_hash.';
