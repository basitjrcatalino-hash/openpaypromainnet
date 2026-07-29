-- Custodial OpenPay Pro ledger balances for major chain assets (synthetic / price-based).
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS btc_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eth_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sol_balance NUMERIC(38, 12) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.wallets.btc_balance IS 'OpenPay Pro ledger BTC balance (custodial, price-based)';
COMMENT ON COLUMN public.wallets.eth_balance IS 'OpenPay Pro ledger ETH balance (custodial, price-based)';
COMMENT ON COLUMN public.wallets.sol_balance IS 'OpenPay Pro ledger SOL balance (custodial, price-based)';
