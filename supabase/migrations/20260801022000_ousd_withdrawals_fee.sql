-- Store 2% withdrawal fee + net payout (fee → same @openpay / 0x30d9… address)

ALTER TABLE public.ousd_withdrawals
  ADD COLUMN IF NOT EXISTS fee_bps INTEGER NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS fee_ousd NUMERIC(18, 8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_ousd NUMERIC(18, 8);

UPDATE public.ousd_withdrawals
SET
  fee_bps = COALESCE(fee_bps, 200),
  fee_ousd = COALESCE(fee_ousd, ROUND(amount * 0.02, 8)),
  net_ousd = COALESCE(net_ousd, ROUND(amount - COALESCE(fee_ousd, ROUND(amount * 0.02, 8)), 8))
WHERE net_ousd IS NULL;

ALTER TABLE public.ousd_withdrawals
  ALTER COLUMN net_ousd SET NOT NULL;

COMMENT ON COLUMN public.ousd_withdrawals.fee_ousd IS
  '2% withdrawal fee credited to the withdrawal fee/treasury address.';
COMMENT ON COLUMN public.ousd_withdrawals.net_ousd IS
  'Amount admin should pay out to destination after fee.';
