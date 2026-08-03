-- Per sign-in method visibility for maintenance (Admin → Auth).
-- Readable by anon so /authpi (pre-login) can hide disabled rails.

CREATE TABLE IF NOT EXISTS public.auth_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  maintenance_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_methods ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.auth_methods TO anon, authenticated;
GRANT ALL ON public.auth_methods TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.auth_methods TO authenticated;

DROP POLICY IF EXISTS "Anyone can view auth methods" ON public.auth_methods;
CREATE POLICY "Anyone can view auth methods"
ON public.auth_methods FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins manage auth methods" ON public.auth_methods;
CREATE POLICY "Admins manage auth methods"
ON public.auth_methods FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_auth_methods_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_auth_methods_updated_at ON public.auth_methods;
CREATE TRIGGER update_auth_methods_updated_at
BEFORE UPDATE ON public.auth_methods
FOR EACH ROW EXECUTE FUNCTION public.set_auth_methods_updated_at();

INSERT INTO public.auth_methods (method_key, label, description, enabled, sort_order) VALUES
  ('openpay', 'OpenPay', 'Sign in with your OpenPay account', true, 0),
  ('phantom', 'Phantom', 'Extension · Google · Apple', true, 1),
  ('solana', 'Solana', 'Phantom extension SIWS', true, 2),
  ('walletconnect', 'WalletConnect', 'EVM wallets', true, 3),
  ('metamask', 'MetaMask', 'Social · Embedded', true, 4),
  ('pi', 'Pi Network', 'Sign in with your Pi account', true, 5),
  ('telegram', 'Telegram', 'Telegram Login', true, 6),
  ('email', 'Email', 'Email and password', true, 7),
  ('privy', 'Privy', 'Google · Apple · Email · SMS', true, 8)
ON CONFLICT (method_key) DO NOTHING;
