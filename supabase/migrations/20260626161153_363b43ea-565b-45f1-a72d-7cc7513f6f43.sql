
-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_roles_self_read ON public.user_roles;
CREATE POLICY user_roles_self_read ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- One-time bootstrap: first signed-in user can claim admin
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RETURN false; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

-- Top-up settings (single row; admin-managed)
CREATE TABLE IF NOT EXISTS public.topup_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  openpay_payment_url text,
  instructions text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.topup_settings TO authenticated;
GRANT ALL ON public.topup_settings TO service_role;
ALTER TABLE public.topup_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS topup_settings_read ON public.topup_settings;
CREATE POLICY topup_settings_read ON public.topup_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS topup_settings_admin_write ON public.topup_settings;
CREATE POLICY topup_settings_admin_write ON public.topup_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.topup_settings(id) VALUES (1) ON CONFLICT DO NOTHING;

-- Vouchers
CREATE TABLE IF NOT EXISTS public.topup_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  amount_ousd numeric(38,8) NOT NULL CHECK (amount_ousd > 0),
  note text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','redeemed','disabled')),
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS topup_vouchers_status_idx ON public.topup_vouchers(status);
GRANT SELECT ON public.topup_vouchers TO authenticated;
GRANT ALL ON public.topup_vouchers TO service_role;
ALTER TABLE public.topup_vouchers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS topup_vouchers_admin_all ON public.topup_vouchers;
CREATE POLICY topup_vouchers_admin_all ON public.topup_vouchers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS topup_vouchers_self_read ON public.topup_vouchers;
CREATE POLICY topup_vouchers_self_read ON public.topup_vouchers FOR SELECT TO authenticated
  USING (redeemed_by = auth.uid());
