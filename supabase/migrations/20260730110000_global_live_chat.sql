-- Global OpenPay Pro live chat (community room — not token-scoped).

CREATE TABLE IF NOT EXISTS public.global_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'text'
    CHECK (kind IN ('text', 'gif', 'sticker', 'emoji')),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS global_chat_created_idx
  ON public.global_chat_messages(created_at DESC);

GRANT SELECT ON public.global_chat_messages TO anon, authenticated;
GRANT INSERT, DELETE ON public.global_chat_messages TO authenticated;
GRANT ALL ON public.global_chat_messages TO service_role;

ALTER TABLE public.global_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS global_chat_public_read ON public.global_chat_messages;
CREATE POLICY global_chat_public_read ON public.global_chat_messages
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS global_chat_insert_own ON public.global_chat_messages;
CREATE POLICY global_chat_insert_own ON public.global_chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS global_chat_delete_own ON public.global_chat_messages;
CREATE POLICY global_chat_delete_own ON public.global_chat_messages
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.global_chat_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
