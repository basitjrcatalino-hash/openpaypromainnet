-- Seed wallet USDT / USDC / SOL ledger top-up into admin-controlled topup_methods
INSERT INTO public.topup_methods (method_key, label, description, enabled, sort_order)
VALUES
  (
    'wallet_usdt',
    'Wallet USDT',
    'Pay with your OpenPay Pro USDT balance → OUSD 1:1',
    true,
    14
  ),
  (
    'wallet_usdc',
    'Wallet USDC',
    'Pay with your OpenPay Pro USDC balance → OUSD 1:1',
    true,
    15
  ),
  (
    'wallet_sol',
    'Wallet SOL',
    'Pay with your OpenPay Pro SOL balance · live Solana price → OUSD',
    true,
    16
  )
ON CONFLICT (method_key) DO UPDATE
SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;
  -- do NOT overwrite enabled — preserve admin maintenance hides
