CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.pi_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  payment_id text NOT NULL UNIQUE,
  txid text,
  pi_amount numeric NOT NULL,
  ousd_credited numeric NOT NULL DEFAULT 0,
  memo text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'created',
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pi_payments TO authenticated;
GRANT ALL ON public.pi_payments TO service_role;

ALTER TABLE public.pi_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own pi payments"
  ON public.pi_payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX pi_payments_user_idx ON public.pi_payments(user_id, created_at DESC);

CREATE TRIGGER pi_payments_set_updated_at
  BEFORE UPDATE ON public.pi_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
