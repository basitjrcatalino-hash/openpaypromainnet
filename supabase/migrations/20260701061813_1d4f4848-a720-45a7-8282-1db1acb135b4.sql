
-- ============ LEDGER ENTRIES ============
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence bigserial UNIQUE NOT NULL,
  tx_id uuid UNIQUE REFERENCES public.transactions(id) ON DELETE SET NULL,
  wallet_id uuid,
  from_address text,
  to_address text,
  asset text,
  amount numeric(38,8) NOT NULL DEFAULT 0,
  usd_value numeric(38,2) NOT NULL DEFAULT 0,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  tx_hash text,
  memo text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ledger_entries_sequence_seq TO service_role;

CREATE INDEX IF NOT EXISTS ledger_entries_occurred_idx ON public.ledger_entries (occurred_at DESC);
CREATE INDEX IF NOT EXISTS ledger_entries_wallet_idx ON public.ledger_entries (wallet_id);
CREATE INDEX IF NOT EXISTS ledger_entries_asset_idx ON public.ledger_entries (asset);
CREATE INDEX IF NOT EXISTS ledger_entries_from_idx ON public.ledger_entries (from_address);
CREATE INDEX IF NOT EXISTS ledger_entries_to_idx ON public.ledger_entries (to_address);

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger admins read all"
  ON public.ledger_entries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Immutable: block updates/deletes from clients (service_role bypasses RLS)
CREATE POLICY "ledger no client writes"
  ON public.ledger_entries FOR ALL
  TO authenticated
  USING (false) WITH CHECK (false);

-- ============ MIRROR TRIGGER ============
CREATE OR REPLACE FUNCTION public.mirror_transaction_to_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wallet_addr text;
BEGIN
  SELECT address INTO wallet_addr FROM public.wallets WHERE id = NEW.wallet_id;

  INSERT INTO public.ledger_entries (
    tx_id, wallet_id, from_address, to_address, asset, amount, usd_value,
    type, status, tx_hash, memo, occurred_at
  ) VALUES (
    NEW.id,
    NEW.wallet_id,
    CASE WHEN NEW.type IN ('send','swap','sell') THEN wallet_addr ELSE NEW.counterparty END,
    CASE WHEN NEW.type IN ('send','swap','sell') THEN NEW.counterparty ELSE wallet_addr END,
    NEW.token_symbol,
    NEW.amount,
    NEW.usd_value,
    NEW.type::text,
    NEW.status::text,
    NEW.tx_hash,
    NEW.memo,
    NEW.created_at
  )
  ON CONFLICT (tx_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_tx_ledger ON public.transactions;
CREATE TRIGGER trg_mirror_tx_ledger
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.mirror_transaction_to_ledger();

-- Backfill
INSERT INTO public.ledger_entries (
  tx_id, wallet_id, from_address, to_address, asset, amount, usd_value,
  type, status, tx_hash, memo, occurred_at
)
SELECT
  t.id, t.wallet_id,
  CASE WHEN t.type::text IN ('send','swap','sell') THEN w.address ELSE t.counterparty END,
  CASE WHEN t.type::text IN ('send','swap','sell') THEN t.counterparty ELSE w.address END,
  t.token_symbol, t.amount, t.usd_value, t.type::text, t.status::text,
  t.tx_hash, t.memo, t.created_at
FROM public.transactions t
LEFT JOIN public.wallets w ON w.id = t.wallet_id
ON CONFLICT (tx_id) DO NOTHING;

-- ============ API KEYS ============
CREATE TABLE IF NOT EXISTS public.ledger_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  prefix text NOT NULL,
  key_hash text UNIQUE NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['read'],
  active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_api_keys TO authenticated;
GRANT ALL ON public.ledger_api_keys TO service_role;

ALTER TABLE public.ledger_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage api keys"
  ON public.ledger_api_keys FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
