CREATE TABLE public.exchange_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  symbol text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exchange_posts_created_idx ON public.exchange_posts (created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exchange_posts TO authenticated;
GRANT SELECT ON public.exchange_posts TO anon;
GRANT ALL ON public.exchange_posts TO service_role;
ALTER TABLE public.exchange_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts readable by everyone" ON public.exchange_posts FOR SELECT USING (true);
CREATE POLICY "users create own posts" ON public.exchange_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own posts" ON public.exchange_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own posts" ON public.exchange_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.exchange_post_likes (
  post_id uuid NOT NULL REFERENCES public.exchange_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.exchange_post_likes TO authenticated;
GRANT SELECT ON public.exchange_post_likes TO anon;
GRANT ALL ON public.exchange_post_likes TO service_role;
ALTER TABLE public.exchange_post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes readable by everyone" ON public.exchange_post_likes FOR SELECT USING (true);
CREATE POLICY "users like as self" ON public.exchange_post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users unlike own" ON public.exchange_post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);