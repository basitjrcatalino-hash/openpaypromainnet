-- Seed Phantom CASH pay into admin-controlled topup_methods
-- Docs: https://docs.phantom.com/cash · mint CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH

INSERT INTO public.topup_methods (method_key, label, description, enabled, sort_order)
VALUES
  (
    'cash_pay',
    'Pay with CASH',
    'Phantom CASH (Solana SPL) · ledger balance or Solana Pay QR → OUSD 1:1',
    true,
    8
  )
ON CONFLICT (method_key) DO UPDATE
SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;
  -- do NOT overwrite enabled — preserve admin maintenance hides
