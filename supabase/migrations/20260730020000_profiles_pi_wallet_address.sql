-- Persist Pi Network wallet address from Pi Auth (wallet_address scope).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pi_wallet_address TEXT;

COMMENT ON COLUMN public.profiles.pi_wallet_address IS
  'Pi Network wallet address from Pi Auth (wallet_address scope); identity link, not OpenPay Pro deposit address';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_pi_wallet_address_uidx
  ON public.profiles (pi_wallet_address)
  WHERE pi_wallet_address IS NOT NULL AND length(trim(pi_wallet_address)) > 0;

-- Keep handle_new_user in sync when metadata includes pi_wallet_address
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text := COALESCE(
    NEW.raw_user_meta_data->>'pi_username',
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1)
  );
BEGIN
  INSERT INTO public.profiles (id, display_name, username, pi_username, pi_uid, pi_wallet_address)
  VALUES (
    NEW.id,
    uname,
    uname,
    NEW.raw_user_meta_data->>'pi_username',
    NEW.raw_user_meta_data->>'pi_uid',
    NULLIF(trim(NEW.raw_user_meta_data->>'pi_wallet_address'), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    pi_uid = COALESCE(EXCLUDED.pi_uid, public.profiles.pi_uid),
    pi_username = COALESCE(EXCLUDED.pi_username, public.profiles.pi_username),
    pi_wallet_address = COALESCE(EXCLUDED.pi_wallet_address, public.profiles.pi_wallet_address),
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    updated_at = now();
  RETURN NEW;
END;
$$;
