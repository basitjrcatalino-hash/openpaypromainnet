-- Admin-configurable top-up fee (deducted from credited OUSD; fee sent to fee wallet).
ALTER TABLE public.topup_settings
  ADD COLUMN IF NOT EXISTS fee_bps integer NOT NULL DEFAULT 0
    CHECK (fee_bps >= 0 AND fee_bps <= 10000),
  ADD COLUMN IF NOT EXISTS fee_wallet_address text;

COMMENT ON COLUMN public.topup_settings.fee_bps IS 'Top-up fee in basis points (100 = 1%). Deducted from gross payment before crediting user.';
COMMENT ON COLUMN public.topup_settings.fee_wallet_address IS 'Wallet address that receives all top-up fees (must exist in wallets table).';
