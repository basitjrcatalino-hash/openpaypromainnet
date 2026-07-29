-- Custodial OpenPay Pro ledger balances for Solana USDC / USDT (synthetic / price-based).
-- Verified Solana mints (Phantom):
--   USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
--   USDT: Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS usdc_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usdt_balance NUMERIC(38, 12) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.wallets.usdc_balance IS 'OpenPay Pro ledger USDC balance (custodial, Solana mint EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)';
COMMENT ON COLUMN public.wallets.usdt_balance IS 'OpenPay Pro ledger USDT balance (custodial, Solana mint Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB)';
