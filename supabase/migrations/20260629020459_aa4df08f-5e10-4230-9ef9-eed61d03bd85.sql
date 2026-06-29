
DO $$ BEGIN
  CREATE TYPE public.kyc_status AS ENUM ('not_started','pending','in_review','verified','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status public.kyc_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS kyc_verification_id text,
  ADD COLUMN IF NOT EXISTS kyc_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_kyc_verification_id ON public.profiles(kyc_verification_id);
