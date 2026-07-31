-- Seed Solana Pay + Circle Mint into admin-controlled topup_methods
-- so they can be hidden during maintenance (same as other Top Up providers).

INSERT INTO public.topup_methods (method_key, label, description, enabled, sort_order)
VALUES
  (
    'solana_pay',
    'Solana Pay',
    'Commerce Kit · wallet connect, PaymentButton, Solana Pay QR → OUSD',
    true,
    6
  ),
  (
    'circle_mint',
    'Circle Deposit',
    'Circle Mint · USDC payin (payment intent + list payments) → OUSD',
    true,
    7
  )
ON CONFLICT (method_key) DO UPDATE
SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;
  -- do NOT overwrite enabled — preserve admin maintenance hides
