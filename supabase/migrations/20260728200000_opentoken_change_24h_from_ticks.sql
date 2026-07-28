-- Keep tokens.change_24h fresh from price ticks (Phantom-style red/green rates).

CREATE OR REPLACE FUNCTION public.ot_refresh_change_24h()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_price numeric;
  pct numeric := 0;
BEGIN
  SELECT t.price INTO ref_price
  FROM public.ot_price_ticks t
  WHERE t.token_id = NEW.token_id
    AND t.created_at <= now() - interval '24 hours'
    AND t.id IS DISTINCT FROM NEW.id
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF ref_price IS NULL THEN
    SELECT t.price INTO ref_price
    FROM public.ot_price_ticks t
    WHERE t.token_id = NEW.token_id
      AND t.id IS DISTINCT FROM NEW.id
    ORDER BY t.created_at ASC
    LIMIT 1;
  END IF;

  IF ref_price IS NOT NULL AND ref_price <> 0 THEN
    pct := ROUND(((NEW.price - ref_price) / ref_price) * 100, 4);
  END IF;

  UPDATE public.tokens
  SET change_24h = pct
  WHERE id = NEW.token_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ot_price_ticks_refresh_change ON public.ot_price_ticks;
CREATE TRIGGER ot_price_ticks_refresh_change
AFTER INSERT ON public.ot_price_ticks
FOR EACH ROW
EXECUTE FUNCTION public.ot_refresh_change_24h();

-- Backfill from earliest tick vs current price
UPDATE public.tokens tok
SET change_24h = ROUND(((tok.price_usd - ref.price) / NULLIF(ref.price, 0)) * 100, 4)
FROM (
  SELECT DISTINCT ON (token_id) token_id, price
  FROM public.ot_price_ticks
  ORDER BY token_id, created_at ASC
) ref
WHERE ref.token_id = tok.id
  AND ref.price IS NOT NULL
  AND ref.price <> 0
  AND tok.price_usd IS NOT NULL;
