CREATE TABLE public.pro_oauth_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  logo_url text,
  website_url text,
  client_id text NOT NULL UNIQUE,
  client_secret_hash text NOT NULL,
  secret_prefix text NOT NULL,
  redirect_uris text[] NOT NULL DEFAULT '{}',
  scopes text[] NOT NULL DEFAULT ARRAY['profile','balance','payments'],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pro_oauth_apps TO service_role;
ALTER TABLE public.pro_oauth_apps ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.pro_oauth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  app_id uuid NOT NULL REFERENCES public.pro_oauth_apps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  scope text NOT NULL DEFAULT 'profile',
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pro_oauth_codes TO service_role;
ALTER TABLE public.pro_oauth_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.pro_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  app_id uuid NOT NULL REFERENCES public.pro_oauth_apps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'profile',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pro_oauth_tokens TO service_role;
ALTER TABLE public.pro_oauth_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX pro_oauth_tokens_user_idx ON public.pro_oauth_tokens (user_id, app_id);

CREATE TABLE public.pro_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.pro_oauth_apps(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'OUSD',
  description text,
  reference text,
  status text NOT NULL DEFAULT 'created',
  payer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  success_url text,
  cancel_url text,
  paid_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pro_charges TO service_role;
ALTER TABLE public.pro_charges ENABLE ROW LEVEL SECURITY;
CREATE INDEX pro_charges_app_idx ON public.pro_charges (app_id, created_at DESC);