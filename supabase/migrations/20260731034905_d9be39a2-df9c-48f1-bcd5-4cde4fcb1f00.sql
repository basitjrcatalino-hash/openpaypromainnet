
CREATE TABLE public.payment_merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  website text,
  settlement_symbol text NOT NULL DEFAULT 'OUSD',
  webhook_url text,
  webhook_secret text,
  api_key_prefix text,
  api_key_hash text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_merchants_user_idx ON public.payment_merchants(user_id);
CREATE INDEX payment_merchants_api_key_idx ON public.payment_merchants(api_key_hash);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_merchants TO authenticated;
GRANT ALL ON public.payment_merchants TO service_role;
ALTER TABLE public.payment_merchants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants manage own account" ON public.payment_merchants
  FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.payment_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.payment_merchants(id) ON DELETE CASCADE,
  public_token text NOT NULL UNIQUE,
  reference text,
  description text,
  customer_email text,
  amount_usd numeric(38,2) NOT NULL,
  chain_id uuid REFERENCES public.deposit_chains(id) ON DELETE SET NULL,
  token_id uuid REFERENCES public.deposit_tokens(id) ON DELETE SET NULL,
  chain_key text,
  token_symbol text,
  token_amount numeric(38,8),
  pay_to_address text,
  from_address text,
  tx_hash text,
  block_number bigint,
  confirmations integer NOT NULL DEFAULT 0,
  required_confirmations integer NOT NULL DEFAULT 12,
  status text NOT NULL DEFAULT 'pending',
  error text,
  ledger_entry_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  detected_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_invoices_tx_idx ON public.payment_invoices(chain_key, lower(tx_hash)) WHERE tx_hash IS NOT NULL;
CREATE INDEX payment_invoices_merchant_idx ON public.payment_invoices(merchant_id, created_at DESC);
CREATE INDEX payment_invoices_status_idx ON public.payment_invoices(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_invoices TO authenticated;
GRANT ALL ON public.payment_invoices TO service_role;
ALTER TABLE public.payment_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants manage own invoices" ON public.payment_invoices
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.payment_merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.payment_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.payment_invoices(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.payment_merchants(id) ON DELETE CASCADE,
  url text NOT NULL,
  event text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  response_code integer,
  response_body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_webhook_invoice_idx ON public.payment_webhook_deliveries(invoice_id);
GRANT SELECT ON public.payment_webhook_deliveries TO authenticated;
GRANT ALL ON public.payment_webhook_deliveries TO service_role;
ALTER TABLE public.payment_webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants view own webhook deliveries" ON public.payment_webhook_deliveries
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.payment_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.payment_invoices(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES public.payment_merchants(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_audit_invoice_idx ON public.payment_audit_logs(invoice_id, created_at DESC);
GRANT SELECT ON public.payment_audit_logs TO authenticated;
GRANT ALL ON public.payment_audit_logs TO service_role;
ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants view own payment audit logs" ON public.payment_audit_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER payment_merchants_updated_at BEFORE UPDATE ON public.payment_merchants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER payment_invoices_updated_at BEFORE UPDATE ON public.payment_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER payment_webhook_deliveries_updated_at BEFORE UPDATE ON public.payment_webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
