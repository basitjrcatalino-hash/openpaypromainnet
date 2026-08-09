CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id uuid,
  snapshot_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  total_usd numeric NOT NULL DEFAULT 0,
  funding_usd numeric NOT NULL DEFAULT 0,
  spot_usd numeric NOT NULL DEFAULT 0,
  trading_usd numeric NOT NULL DEFAULT 0,
  p2p_usd numeric NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS portfolio_snapshots_user_date_idx
  ON public.portfolio_snapshots (user_id, snapshot_date DESC);

GRANT SELECT, INSERT, UPDATE ON public.portfolio_snapshots TO authenticated;
GRANT ALL ON public.portfolio_snapshots TO service_role;

ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own snapshots select" ON public.portfolio_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own snapshots insert" ON public.portfolio_snapshots
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own snapshots update" ON public.portfolio_snapshots
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);