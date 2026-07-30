-- Creator profile setup fields (public social bio + links)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS twitter_url text;

COMMENT ON COLUMN public.profiles.bio IS
  'Short public bio shown on OpenToken creator profile';
COMMENT ON COLUMN public.profiles.website_url IS
  'Optional website URL on creator profile';
COMMENT ON COLUMN public.profiles.twitter_url IS
  'Optional X/Twitter handle or URL on creator profile';
