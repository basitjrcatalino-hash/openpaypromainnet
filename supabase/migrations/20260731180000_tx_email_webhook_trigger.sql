-- Catch-all: every confirmed transactions INSERT notifies the app webhook so users
-- always get Resend email alerts (deduped in app via email_send_log message_id).
--
-- Configure once after migrate (service role SQL editor):
--   UPDATE public.tx_email_webhook_config
--   SET secret = '<TX_WEBHOOK_SECRET from .env>',
--       url = 'https://openpaypro.space/api/webhooks/transactions',
--       enabled = true
--   WHERE id = 1;

CREATE TABLE IF NOT EXISTS public.tx_email_webhook_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  url TEXT NOT NULL DEFAULT 'https://openpaypro.space/api/webhooks/transactions',
  secret TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.tx_email_webhook_config TO service_role;
ALTER TABLE public.tx_email_webhook_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.tx_email_webhook_config (id, url, secret, enabled)
VALUES (1, 'https://openpaypro.space/api/webhooks/transactions', '', false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_tx_email_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cfg public.tx_email_webhook_config%ROWTYPE;
  req_id BIGINT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Only fire for settled user activity
  IF NEW.status IS DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO cfg FROM public.tx_email_webhook_config WHERE id = 1;
  IF NOT FOUND OR NOT cfg.enabled OR cfg.secret IS NULL OR length(trim(cfg.secret)) = 0 THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT net.http_post(
      url := cfg.url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', cfg.secret
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'transactions',
        'record', to_jsonb(NEW)
      )
    ) INTO req_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_tx_email_webhook failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_email_webhook ON public.transactions;
CREATE TRIGGER trg_transactions_email_webhook
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tx_email_webhook();

REVOKE ALL ON FUNCTION public.notify_tx_email_webhook() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_tx_email_webhook() TO service_role;
