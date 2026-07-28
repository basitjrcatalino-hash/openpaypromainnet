-- OpenToken: 100 OUSD mint fee default + per-token live chat (text / gif / sticker).

ALTER TABLE public.tokens
  ALTER COLUMN launch_fee_pi SET DEFAULT 100;

CREATE TABLE IF NOT EXISTS public.ot_token_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'text'
    CHECK (kind IN ('text', 'gif', 'sticker', 'emoji')),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ot_token_chat_token_idx
  ON public.ot_token_chat_messages(token_id, created_at DESC);

GRANT SELECT ON public.ot_token_chat_messages TO anon, authenticated;
GRANT INSERT, DELETE ON public.ot_token_chat_messages TO authenticated;
GRANT ALL ON public.ot_token_chat_messages TO service_role;

ALTER TABLE public.ot_token_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ot_chat_public_read ON public.ot_token_chat_messages;
CREATE POLICY ot_chat_public_read ON public.ot_token_chat_messages
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS ot_chat_insert_own ON public.ot_token_chat_messages;
CREATE POLICY ot_chat_insert_own ON public.ot_token_chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ot_chat_delete_own ON public.ot_token_chat_messages;
CREATE POLICY ot_chat_delete_own ON public.ot_token_chat_messages
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

-- Enable realtime for live chat (safe if already added).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ot_token_chat_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
