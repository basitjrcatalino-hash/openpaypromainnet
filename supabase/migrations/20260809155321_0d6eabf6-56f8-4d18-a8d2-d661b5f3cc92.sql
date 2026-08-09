CREATE TABLE public.turnkey_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'user' CHECK (kind IN ('user','company')),
  label TEXT,
  sub_organization_id TEXT,
  wallet_id TEXT NOT NULL,
  solana_address TEXT,
  evm_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX turnkey_wallets_user_unique ON public.turnkey_wallets (user_id) WHERE kind = 'user';
CREATE INDEX turnkey_wallets_kind_idx ON public.turnkey_wallets (kind);

GRANT SELECT ON public.turnkey_wallets TO authenticated;
GRANT ALL ON public.turnkey_wallets TO service_role;

ALTER TABLE public.turnkey_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own turnkey wallet"
  ON public.turnkey_wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view company turnkey wallets"
  ON public.turnkey_wallets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER turnkey_wallets_set_updated_at
  BEFORE UPDATE ON public.turnkey_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();