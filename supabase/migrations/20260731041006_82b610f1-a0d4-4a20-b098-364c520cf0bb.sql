CREATE TABLE public.topup_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.topup_methods TO authenticated;
GRANT ALL ON public.topup_methods TO service_role;

ALTER TABLE public.topup_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view topup methods"
ON public.topup_methods FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage topup methods"
ON public.topup_methods FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT INSERT, UPDATE, DELETE ON public.topup_methods TO authenticated;

CREATE OR REPLACE FUNCTION public.set_topup_methods_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_topup_methods_updated_at
BEFORE UPDATE ON public.topup_methods
FOR EACH ROW EXECUTE FUNCTION public.set_topup_methods_updated_at();

INSERT INTO public.topup_methods (method_key, label, description, enabled, sort_order) VALUES
('openpay_balance', 'OpenPay Balance', 'Pay from your connected OpenPay account · real debit', true, 1),
('moonpay', 'MoonPay', 'Card / Apple Pay / Google Pay · MoonPay → OUSD', true, 2),
('pi', 'Pi Network (π)', 'Pay with Pi · live π price → OUSD ($1) credited instantly', true, 3),
('usdc', 'USDC Pay', 'Pay with USDC · MoonPay Commerce → OUSD', true, 4),
('helio', 'Crypto Deposit', 'SOL / crypto · MoonPay Commerce → OUSD', true, 5);