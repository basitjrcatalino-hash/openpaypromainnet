-- Scan to pay top-up rail (multi-chain QR → verify TX → OUSD / OpenLedger)
-- Receive wallets are managed in Admin → Deposits (deposit_addresses).

INSERT INTO public.topup_methods (method_key, label, description, enabled, sort_order)
VALUES
  (
    'scan_pay',
    'Scan to pay',
    'Multi-chain QR · SOL / USDC / USDT / CASH stables → verify TX → OUSD on OpenLedger',
    true,
    13
  )
ON CONFLICT (method_key) DO UPDATE
SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Phantom CASH on Solana (SPL) for scan / deposit gateway
INSERT INTO public.deposit_tokens (
  chain_id, name, symbol, contract_address, decimals, credit_symbol, min_deposit, sort_order, deposit_enabled, status
)
SELECT
  c.id,
  'CASH',
  'CASH',
  'CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH',
  6,
  'OUSD',
  1,
  30,
  true,
  'active'
FROM public.deposit_chains c
WHERE c.key = 'solana'
  AND NOT EXISTS (
    SELECT 1
    FROM public.deposit_tokens t
    WHERE t.chain_id = c.id
      AND t.symbol = 'CASH'
  );

-- Prefer OUSD credit for major stables used in Scan to pay (leave ETH/SOL native credits)
UPDATE public.deposit_tokens t
SET
  credit_symbol = 'OUSD',
  usd_rate = COALESCE(t.usd_rate, 1)
WHERE t.symbol IN ('USDC', 'USDT', 'CASH', 'PYUSD', 'USDG', 'USD1')
  AND t.credit_symbol IS DISTINCT FROM 'OUSD';
