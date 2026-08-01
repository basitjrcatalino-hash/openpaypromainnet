-- Enable Realtime for P2P order / message alerts (sounds + toasts in the app).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.p2p_orders;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.p2p_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
