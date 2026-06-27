
-- Add username + pi linkage to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS pi_username text,
  ADD COLUMN IF NOT EXISTS pi_uid text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pi_uid_unique
  ON public.profiles (pi_uid) WHERE pi_uid IS NOT NULL;

-- Allow authenticated users to look up other profiles by username for transfers
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

-- Security & preferences extensions
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS biometric_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recovery_backed_up boolean NOT NULL DEFAULT false;

-- Update new-user trigger to honour Pi metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uname text := COALESCE(NEW.raw_user_meta_data->>'pi_username', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1));
BEGIN
  INSERT INTO public.profiles (id, display_name, username, pi_username, pi_uid)
  VALUES (
    NEW.id,
    uname,
    uname,
    NEW.raw_user_meta_data->>'pi_username',
    NEW.raw_user_meta_data->>'pi_uid'
  )
  ON CONFLICT (id) DO UPDATE
    SET pi_username = COALESCE(EXCLUDED.pi_username, public.profiles.pi_username),
        pi_uid      = COALESCE(EXCLUDED.pi_uid, public.profiles.pi_uid),
        display_name= COALESCE(public.profiles.display_name, EXCLUDED.display_name),
        username    = COALESCE(public.profiles.username, EXCLUDED.username);
  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

-- Backfill existing Pi users
UPDATE public.profiles p
SET pi_username = u.raw_user_meta_data->>'pi_username',
    pi_uid      = u.raw_user_meta_data->>'pi_uid',
    display_name = COALESCE(p.display_name, u.raw_user_meta_data->>'pi_username'),
    username     = COALESCE(p.username, u.raw_user_meta_data->>'pi_username')
FROM auth.users u
WHERE u.id = p.id
  AND u.raw_user_meta_data->>'pi_username' IS NOT NULL;
