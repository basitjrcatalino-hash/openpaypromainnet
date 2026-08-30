CREATE TABLE IF NOT EXISTS public.airdrop_campaign_secrets (
  campaign_id uuid PRIMARY KEY REFERENCES public.airdrop_campaigns(id) ON DELETE CASCADE,
  claim_code text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS airdrop_campaign_secrets_code_uidx
  ON public.airdrop_campaign_secrets (upper(claim_code));

REVOKE ALL ON public.airdrop_campaign_secrets FROM anon, authenticated;
GRANT ALL ON public.airdrop_campaign_secrets TO service_role;
ALTER TABLE public.airdrop_campaign_secrets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'airdrop_campaigns' AND column_name = 'claim_code'
  ) THEN
    INSERT INTO public.airdrop_campaign_secrets (campaign_id, claim_code)
    SELECT id, claim_code FROM public.airdrop_campaigns
    WHERE claim_code IS NOT NULL AND length(trim(claim_code)) > 0
    ON CONFLICT (campaign_id) DO NOTHING;

    ALTER TABLE public.airdrop_campaigns DROP COLUMN claim_code;
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.airdrop_campaigns TO authenticated;
GRANT ALL ON public.airdrop_campaigns TO service_role;