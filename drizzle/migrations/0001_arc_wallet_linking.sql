CREATE TABLE public.arc_wallet_links (
 address text PRIMARY KEY CHECK (address ~ '^0x[0-9a-f]{40}$'),
 user_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.arc_wallet_links TO authenticated;
GRANT ALL ON public.arc_wallet_links TO service_role;
ALTER TABLE public.arc_wallet_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY arc_links_owner_read ON public.arc_wallet_links FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX arc_links_user_idx ON public.arc_wallet_links(user_id);
CREATE TABLE public.arc_auth_challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 address text NOT NULL,
 user_id uuid,
 purpose text NOT NULL CHECK (purpose IN ('link', 'login')),
 message text NOT NULL,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.arc_auth_challenges TO service_role;
ALTER TABLE public.arc_auth_challenges ENABLE ROW LEVEL SECURITY;
CREATE INDEX arc_challenge_expiration_idx ON public.arc_auth_challenges(expires_at);