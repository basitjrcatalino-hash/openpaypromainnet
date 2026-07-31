-- Seed Banxa Apple Pay / Google Pay / Cards / Bank Transfer into topup_methods
-- Docs: https://docs.banxa.com/products/native-api/docs/guides/apple-pay
--       https://docs.banxa.com/products/native-api/docs/guides/google-pay
--       https://docs.banxa.com/products/native-api/docs/guides/cards
--       https://docs.banxa.com/products/native-api/docs/guides/bank-transfer
-- Hosted Checkout paymentMethodId: apple-pay | google-pay | debit-credit-card | bank rails

INSERT INTO public.topup_methods (method_key, label, description, enabled, sort_order)
VALUES
  (
    'banxa_apple_pay',
    'Apple Pay',
    'Banxa · Apple Pay (Face ID / Touch ID) → crypto settle → OUSD',
    true,
    9
  ),
  (
    'banxa_google_pay',
    'Google Pay',
    'Banxa · Google Pay → crypto settle → OUSD',
    true,
    10
  ),
  (
    'banxa_card',
    'Card',
    'Banxa · debit / credit card → crypto settle → OUSD',
    true,
    11
  ),
  (
    'banxa_bank',
    'Bank Transfer',
    'Banxa · bank transfer (ACH / SEPA / Faster Payments / PayID) → OUSD',
    true,
    12
  )
ON CONFLICT (method_key) DO UPDATE
SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;
  -- do NOT overwrite enabled — preserve admin maintenance hides

CREATE TABLE IF NOT EXISTS public.banxa_topup_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.wallets (id) ON DELETE CASCADE,
  method_key text NOT NULL,
  banxa_order_id text,
  external_order_id text NOT NULL UNIQUE,
  fiat_currency text NOT NULL DEFAULT 'USD',
  fiat_amount numeric NOT NULL,
  payment_method_id text NOT NULL,
  checkout_url text,
  status text NOT NULL DEFAULT 'created',
  credited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS banxa_topup_orders_banxa_order_id_idx
  ON public.banxa_topup_orders (banxa_order_id);

CREATE INDEX IF NOT EXISTS banxa_topup_orders_user_id_idx
  ON public.banxa_topup_orders (user_id);

ALTER TABLE public.banxa_topup_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY banxa_topup_orders_select_own
  ON public.banxa_topup_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.banxa_topup_orders TO authenticated;
GRANT ALL ON public.banxa_topup_orders TO service_role;
