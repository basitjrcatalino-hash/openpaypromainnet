-- Add destination rail: pi | openpay (OP… accounts)

ALTER TABLE public.ousd_withdrawals
  ADD COLUMN IF NOT EXISTS destination_kind TEXT
    CHECK (destination_kind IS NULL OR destination_kind IN ('pi', 'openpay'));

COMMENT ON COLUMN public.ousd_withdrawals.destination_kind IS
  'Withdrawal destination rail: pi (G… wallet) or openpay (OP… account).';
