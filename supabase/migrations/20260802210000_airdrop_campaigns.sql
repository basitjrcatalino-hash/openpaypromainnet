-- Airdrop campaigns (OUSD / USDT / USDC) — admin-created promo / challenge rewards

DO $$ BEGIN
  CREATE TYPE public.airdrop_claim_mode AS ENUM ('open', 'code');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.airdrop_status AS ENUM ('draft', 'live', 'paused', 'ended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.airdrop_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  description text,
  notes text,
  asset text NOT NULL CHECK (asset IN ('OUSD', 'USDT', 'USDC')),
  amount_per_claim numeric(38, 8) NOT NULL CHECK (amount_per_claim > 0),
  claim_mode public.airdrop_claim_mode NOT NULL DEFAULT 'open',
  claim_code text,
  status public.airdrop_status NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  total_budget numeric(38, 8) CHECK (total_budget IS NULL OR total_budget > 0),
  max_claims integer CHECK (max_claims IS NULL OR max_claims > 0),
  claimed_count integer NOT NULL DEFAULT 0 CHECK (claimed_count >= 0),
  distributed_amount numeric(38, 8) NOT NULL DEFAULT 0 CHECK (distributed_amount >= 0),
  require_wallet boolean NOT NULL DEFAULT true,
  require_kyc boolean NOT NULL DEFAULT false,
  requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover_url text,
  badge text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT airdrop_campaigns_code_when_mode CHECK (
    claim_mode <> 'code' OR (claim_code IS NOT NULL AND length(trim(claim_code)) >= 4)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS airdrop_campaigns_claim_code_uidx
  ON public.airdrop_campaigns (upper(claim_code))
  WHERE claim_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS airdrop_campaigns_status_idx
  ON public.airdrop_campaigns (status);

CREATE INDEX IF NOT EXISTS airdrop_campaigns_live_window_idx
  ON public.airdrop_campaigns (status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS public.airdrop_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.airdrop_campaigns (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.wallets (id) ON DELETE RESTRICT,
  asset text NOT NULL CHECK (asset IN ('OUSD', 'USDT', 'USDC')),
  amount numeric(38, 8) NOT NULL CHECK (amount > 0),
  tx_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS airdrop_claims_user_idx
  ON public.airdrop_claims (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS airdrop_claims_campaign_idx
  ON public.airdrop_claims (campaign_id);

CREATE OR REPLACE FUNCTION public.set_airdrop_campaigns_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS airdrop_campaigns_updated_at ON public.airdrop_campaigns;
CREATE TRIGGER airdrop_campaigns_updated_at
BEFORE UPDATE ON public.airdrop_campaigns
FOR EACH ROW EXECUTE FUNCTION public.set_airdrop_campaigns_updated_at();

GRANT SELECT ON public.airdrop_campaigns TO authenticated;
GRANT ALL ON public.airdrop_campaigns TO service_role;
GRANT SELECT ON public.airdrop_claims TO authenticated;
GRANT ALL ON public.airdrop_claims TO service_role;

ALTER TABLE public.airdrop_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airdrop_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS airdrop_campaigns_admin_all ON public.airdrop_campaigns;
CREATE POLICY airdrop_campaigns_admin_all ON public.airdrop_campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can read live campaigns (claim_code redacted in app layer)
DROP POLICY IF EXISTS airdrop_campaigns_live_read ON public.airdrop_campaigns;
CREATE POLICY airdrop_campaigns_live_read ON public.airdrop_campaigns
  FOR SELECT TO authenticated
  USING (status = 'live');

DROP POLICY IF EXISTS airdrop_claims_admin_all ON public.airdrop_claims;
CREATE POLICY airdrop_claims_admin_all ON public.airdrop_claims
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS airdrop_claims_self_read ON public.airdrop_claims;
CREATE POLICY airdrop_claims_self_read ON public.airdrop_claims
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
