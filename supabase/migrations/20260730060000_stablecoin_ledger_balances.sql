-- Custodial OpenPay Pro ledger balances for additional stablecoins.
-- Verified mints / contracts (Phantom):
--   PYUSD Solana: 2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo
--   USDG  Solana: 2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH
--   USD1  Solana: USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB
--   CASH  Solana: CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH
--   EURC  Ethereum: 0x1abaea1f7c830bd89acc67ec4af516284b1bc33c
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS pyusd_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usdg_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usd1_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eurc_balance NUMERIC(38, 12) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.wallets.pyusd_balance IS 'OpenPay Pro ledger PYUSD (PayPal USD) — Solana mint 2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo';
COMMENT ON COLUMN public.wallets.usdg_balance IS 'OpenPay Pro ledger USDG (Global Dollar) — Solana mint 2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH';
COMMENT ON COLUMN public.wallets.usd1_balance IS 'OpenPay Pro ledger USD1 — Solana mint USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB';
COMMENT ON COLUMN public.wallets.cash_balance IS 'OpenPay Pro ledger CASH — Solana mint CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH';
COMMENT ON COLUMN public.wallets.eurc_balance IS 'OpenPay Pro ledger EURC — Ethereum 0x1abaea1f7c830bd89acc67ec4af516284b1bc33c';
