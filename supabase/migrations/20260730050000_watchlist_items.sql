-- Phantom-style watchlist (majors + OpenTokens)

CREATE TABLE IF NOT EXISTS public.watchlist_items (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, asset_key),
  CONSTRAINT watchlist_items_asset_key_check CHECK (
    asset_key ~ '^(major:[a-z0-9]+|token:[0-9a-f-]{36}|ousd)$'
  )
);

CREATE INDEX IF NOT EXISTS watchlist_items_user_created_idx
  ON public.watchlist_items (user_id, created_at DESC);

ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "watchlist_select_own" ON public.watchlist_items;
CREATE POLICY "watchlist_select_own" ON public.watchlist_items
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "watchlist_insert_own" ON public.watchlist_items;
CREATE POLICY "watchlist_insert_own" ON public.watchlist_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "watchlist_delete_own" ON public.watchlist_items;
CREATE POLICY "watchlist_delete_own" ON public.watchlist_items
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.watchlist_items TO authenticated;
