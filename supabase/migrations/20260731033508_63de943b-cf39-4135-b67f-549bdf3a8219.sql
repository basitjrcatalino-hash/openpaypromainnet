-- ============ Chains ============
CREATE TABLE public.deposit_chains (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  chain_id integer,
  family text NOT NULL DEFAULT 'evm',
  rpc_url text,
  explorer_url text,
  required_confirmations integer NOT NULL DEFAULT 12,
  bridge_status text NOT NULL DEFAULT 'native',
  is_enabled boolean NOT NULL DEFAULT false,
  maintenance_mode boolean NOT NULL DEFAULT false,
  logo_url text,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.deposit_chains TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposit_chains TO authenticated;
GRANT ALL ON public.deposit_chains TO service_role;
ALTER TABLE public.deposit_chains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view enabled chains" ON public.deposit_chains
  FOR SELECT USING (is_enabled = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage chains" ON public.deposit_chains
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Tokens ============
CREATE TABLE public.deposit_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id uuid NOT NULL REFERENCES public.deposit_chains(id) ON DELETE CASCADE,
  name text NOT NULL,
  symbol text NOT NULL,
  contract_address text,
  decimals integer NOT NULL DEFAULT 18,
  logo_url text,
  deposit_enabled boolean NOT NULL DEFAULT false,
  withdrawal_enabled boolean NOT NULL DEFAULT false,
  min_deposit numeric(38,8) NOT NULL DEFAULT 0,
  max_deposit numeric(38,8),
  deposit_fee_bps integer NOT NULL DEFAULT 0,
  credit_symbol text NOT NULL DEFAULT 'OUSD',
  usd_rate numeric(38,8),
  status text NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, symbol, contract_address)
);

GRANT SELECT ON public.deposit_tokens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposit_tokens TO authenticated;
GRANT ALL ON public.deposit_tokens TO service_role;
ALTER TABLE public.deposit_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active tokens" ON public.deposit_tokens
  FOR SELECT USING (status = 'active' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage tokens" ON public.deposit_tokens
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Deposit addresses ============
CREATE TABLE public.deposit_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id uuid NOT NULL REFERENCES public.deposit_chains(id) ON DELETE CASCADE,
  token_id uuid REFERENCES public.deposit_tokens(id) ON DELETE CASCADE,
  address text NOT NULL,
  label text,
  memo_tag text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.deposit_addresses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposit_addresses TO authenticated;
GRANT ALL ON public.deposit_addresses TO service_role;
ALTER TABLE public.deposit_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active deposit addresses" ON public.deposit_addresses
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage deposit addresses" ON public.deposit_addresses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Deposits ============
CREATE TABLE public.deposits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  chain_id uuid REFERENCES public.deposit_chains(id) ON DELETE SET NULL,
  token_id uuid REFERENCES public.deposit_tokens(id) ON DELETE SET NULL,
  chain_key text NOT NULL,
  token_symbol text NOT NULL,
  tx_hash text NOT NULL,
  from_address text,
  to_address text NOT NULL,
  amount numeric(38,8) NOT NULL,
  fee_amount numeric(38,8) NOT NULL DEFAULT 0,
  credited_amount numeric(38,8) NOT NULL DEFAULT 0,
  usd_value numeric(38,2) NOT NULL DEFAULT 0,
  block_number bigint,
  confirmations integer NOT NULL DEFAULT 0,
  required_confirmations integer NOT NULL DEFAULT 12,
  status text NOT NULL DEFAULT 'pending',
  error text,
  ledger_entry_id uuid,
  transaction_id uuid,
  detected_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  credited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_key, tx_hash)
);

CREATE INDEX deposits_user_idx ON public.deposits (user_id, created_at DESC);
CREATE INDEX deposits_status_idx ON public.deposits (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own deposits" ON public.deposits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own deposit claims" ON public.deposits
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins manage deposits" ON public.deposits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Audit log ============
CREATE TABLE public.deposit_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deposit_id uuid REFERENCES public.deposits(id) ON DELETE CASCADE,
  actor_id uuid,
  event text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.deposit_audit_logs TO authenticated;
GRANT ALL ON public.deposit_audit_logs TO service_role;
ALTER TABLE public.deposit_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read deposit audit logs" ON public.deposit_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ updated_at triggers ============
CREATE TRIGGER deposit_chains_updated_at BEFORE UPDATE ON public.deposit_chains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER deposit_tokens_updated_at BEFORE UPDATE ON public.deposit_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER deposit_addresses_updated_at BEFORE UPDATE ON public.deposit_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER deposits_updated_at BEFORE UPDATE ON public.deposits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Seed chains ============
INSERT INTO public.deposit_chains (key, name, chain_id, family, explorer_url, required_confirmations, sort_order, is_enabled) VALUES
  ('ethereum', 'Ethereum', 1, 'evm', 'https://etherscan.io', 12, 10, true),
  ('solana', 'Solana', NULL, 'solana', 'https://solscan.io', 32, 20, true),
  ('base', 'Base', 8453, 'evm', 'https://basescan.org', 12, 30, true),
  ('polygon', 'Polygon', 137, 'evm', 'https://polygonscan.com', 64, 40, true),
  ('bnb', 'BNB Chain', 56, 'evm', 'https://bscscan.com', 15, 50, true),
  ('arbitrum', 'Arbitrum', 42161, 'evm', 'https://arbiscan.io', 12, 60, true),
  ('optimism', 'Optimism', 10, 'evm', 'https://optimistic.etherscan.io', 12, 70, true),
  ('avalanche', 'Avalanche', 43114, 'evm', 'https://snowtrace.io', 12, 80, true);

-- ============ Seed tokens ============
INSERT INTO public.deposit_tokens (chain_id, name, symbol, contract_address, decimals, credit_symbol, min_deposit, sort_order)
SELECT c.id, t.name, t.symbol, t.contract, t.decimals, t.credit, t.min_dep, t.sort
FROM public.deposit_chains c
JOIN (VALUES
  ('ethereum', 'Ether', 'ETH', NULL, 18, 'ETH', 0.001, 10),
  ('ethereum', 'Tether USD', 'USDT', '0xdac17f958d2ee523a2206206994597c13d831ec7', 6, 'USDT', 1, 20),
  ('ethereum', 'USD Coin', 'USDC', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 6, 'USDC', 1, 30),
  ('solana', 'Solana', 'SOL', NULL, 9, 'SOL', 0.01, 10),
  ('solana', 'USD Coin', 'USDC', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 6, 'USDC', 1, 20),
  ('base', 'Ether', 'ETH', NULL, 18, 'ETH', 0.001, 10),
  ('base', 'USD Coin', 'USDC', '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 6, 'USDC', 1, 20),
  ('polygon', 'Tether USD', 'USDT', '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', 6, 'USDT', 1, 10),
  ('polygon', 'USD Coin', 'USDC', '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', 6, 'USDC', 1, 20),
  ('bnb', 'Tether USD', 'USDT', '0x55d398326f99059ff775485246999027b3197955', 18, 'USDT', 1, 10),
  ('arbitrum', 'USD Coin', 'USDC', '0xaf88d065e77c8cc2239327c5edb3a432268e5831', 6, 'USDC', 1, 10),
  ('optimism', 'USD Coin', 'USDC', '0x0b2c639c533813f4aa9d7837caf62653d097ff85', 6, 'USDC', 1, 10),
  ('avalanche', 'USD Coin', 'USDC', '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', 6, 'USDC', 1, 10)
) AS t(chain_key, name, symbol, contract, decimals, credit, min_dep, sort)
  ON t.chain_key = c.key;