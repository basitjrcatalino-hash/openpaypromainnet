-- Complete OpenPay Pro ledger coverage for every wallet transaction
-- (send, receive, buy/top-up, sell, swap, mint, reward).

-- Allow the SECURITY DEFINER mirror function to advance the sequence
GRANT USAGE, SELECT ON SEQUENCE public.ledger_entries_sequence_seq TO postgres;
GRANT USAGE, SELECT ON SEQUENCE public.ledger_entries_sequence_seq TO service_role;

CREATE OR REPLACE FUNCTION public.mirror_transaction_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet_addr text;
  is_outflow boolean;
BEGIN
  SELECT address INTO wallet_addr FROM public.wallets WHERE id = NEW.wallet_id;

  -- Outflows leave the wallet; everything else is treated as an inflow/credit.
  is_outflow := NEW.type::text IN ('send', 'swap', 'sell');

  INSERT INTO public.ledger_entries (
    tx_id, wallet_id, from_address, to_address, asset, amount, usd_value,
    type, status, tx_hash, memo, occurred_at
  ) VALUES (
    NEW.id,
    NEW.wallet_id,
    CASE WHEN is_outflow THEN wallet_addr ELSE COALESCE(NEW.counterparty, 'external') END,
    CASE WHEN is_outflow THEN COALESCE(NEW.counterparty, 'external') ELSE wallet_addr END,
    COALESCE(NEW.token_symbol, 'OUSD'),
    NEW.amount,
    COALESCE(NEW.usd_value, 0),
    NEW.type::text,
    COALESCE(NEW.status::text, 'confirmed'),
    NEW.tx_hash,
    NEW.memo,
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (tx_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_tx_ledger ON public.transactions;
CREATE TRIGGER trg_mirror_tx_ledger
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.mirror_transaction_to_ledger();

-- Re-backfill any historical rows that never made it into the ledger
CREATE OR REPLACE FUNCTION public.backfill_ledger_entries()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  INSERT INTO public.ledger_entries (
    tx_id, wallet_id, from_address, to_address, asset, amount, usd_value,
    type, status, tx_hash, memo, occurred_at
  )
  SELECT
    t.id,
    t.wallet_id,
    CASE
      WHEN t.type::text IN ('send', 'swap', 'sell') THEN w.address
      ELSE COALESCE(t.counterparty, 'external')
    END,
    CASE
      WHEN t.type::text IN ('send', 'swap', 'sell') THEN COALESCE(t.counterparty, 'external')
      ELSE w.address
    END,
    COALESCE(t.token_symbol, 'OUSD'),
    t.amount,
    COALESCE(t.usd_value, 0),
    t.type::text,
    COALESCE(t.status::text, 'confirmed'),
    t.tx_hash,
    t.memo,
    COALESCE(t.created_at, now())
  FROM public.transactions t
  LEFT JOIN public.wallets w ON w.id = t.wallet_id
  ON CONFLICT (tx_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN jsonb_build_object('inserted', inserted_count);
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_ledger_entries() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_ledger_entries() TO service_role;

-- Run once on migrate
SELECT public.backfill_ledger_entries();
