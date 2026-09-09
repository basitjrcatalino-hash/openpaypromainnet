CREATE TABLE IF NOT EXISTS public.scanner_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  message TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.scanner_targets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scanner_targets TO authenticated;
GRANT ALL ON public.scanner_targets TO service_role;

ALTER TABLE public.scanner_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scanner_targets_public_read" ON public.scanner_targets;
CREATE POLICY "scanner_targets_public_read" ON public.scanner_targets FOR SELECT USING (true);

DROP POLICY IF EXISTS "scanner_targets_admin_write" ON public.scanner_targets;
CREATE POLICY "scanner_targets_admin_write" ON public.scanner_targets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.scanner_targets (target_key, label, description, sort_order) VALUES
  ('openpay_pro', 'OpenPay Pro wallet', '0x… wallet QR, /pay links, OpenToken QR', 0),
  ('openpay', 'OpenPay account', 'OP… account numbers, @username, openpay:// links', 1),
  ('pi_wallet', 'Pi Wallet', 'G… Pi / Stellar addresses', 2),
  ('qrph', 'QR Ph / InstaPay', 'EMVCo bank & e-wallet QR (GCash, Maya, banks)', 3),
  ('walletconnect', 'WalletConnect Pay', 'WalletConnect pay links', 4)
ON CONFLICT (target_key) DO NOTHING;