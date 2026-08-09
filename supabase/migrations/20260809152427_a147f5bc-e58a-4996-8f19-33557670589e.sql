ALTER TABLE public.deposit_addresses
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_ref text,
  ADD COLUMN IF NOT EXISTS derivation_index bigint,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

CREATE INDEX IF NOT EXISTS deposit_addresses_user_idx
  ON public.deposit_addresses (user_id, chain_id);

DROP POLICY IF EXISTS "Anyone can view active deposit addresses" ON public.deposit_addresses;
CREATE POLICY "View shared or own deposit addresses"
  ON public.deposit_addresses FOR SELECT
  USING (
    (is_active = true AND user_id IS NULL)
    OR user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Atomically hand out a pooled address to a user (one per chain).
CREATE OR REPLACE FUNCTION public.claim_deposit_address(_user_id uuid, _chain_id uuid)
RETURNS public.deposit_addresses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_out public.deposit_addresses;
BEGIN
  SELECT * INTO row_out
  FROM public.deposit_addresses
  WHERE chain_id = _chain_id AND user_id = _user_id AND is_active = true
  ORDER BY assigned_at NULLS LAST
  LIMIT 1;
  IF FOUND THEN
    RETURN row_out;
  END IF;

  SELECT * INTO row_out
  FROM public.deposit_addresses
  WHERE chain_id = _chain_id
    AND user_id IS NULL
    AND is_active = true
    AND provider = 'pool'
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.deposit_addresses
  SET user_id = _user_id, assigned_at = now(), updated_at = now()
  WHERE id = row_out.id
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_deposit_address(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_deposit_address(uuid, uuid) TO service_role;

CREATE TABLE IF NOT EXISTS public.deposit_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.deposit_webhook_events TO authenticated;
GRANT ALL ON public.deposit_webhook_events TO service_role;

ALTER TABLE public.deposit_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read deposit webhook events"
  ON public.deposit_webhook_events FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE UNIQUE INDEX IF NOT EXISTS deposit_webhook_events_provider_event_unique
  ON public.deposit_webhook_events (provider, provider_event_id);

DROP TRIGGER IF EXISTS deposit_webhook_events_updated_at ON public.deposit_webhook_events;
CREATE TRIGGER deposit_webhook_events_updated_at
  BEFORE UPDATE ON public.deposit_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();