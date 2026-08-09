CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  label text NOT NULL,
  feature_group text NOT NULL DEFAULT 'General',
  path_prefix text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  message text,
  sort_order integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.feature_flags TO anon;
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_flags_public_read" ON public.feature_flags;
CREATE POLICY "feature_flags_public_read" ON public.feature_flags FOR SELECT USING (true);

DROP POLICY IF EXISTS "feature_flags_admin_write" ON public.feature_flags;
CREATE POLICY "feature_flags_admin_write" ON public.feature_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.feature_flags (feature_key, label, feature_group, path_prefix, sort_order) VALUES
  ('global','Entire app (global maintenance)','Global','*',0),
  ('dashboard','Dashboard','Wallet','/dashboard',10),
  ('assets','Assets','Wallet',  '/assets',20),
  ('deposit','Deposit','Money','/deposit',30),
  ('topup','Top Up','Money','/topup',40),
  ('receive','Receive','Money','/wallet/receive',50),
  ('send','Send','Money','/send',60),
  ('transfer','Transfer','Money','/transfer',70),
  ('withdraw','Withdraw','Money','/withdraw',80),
  ('swap','Swap','Money','/swap',90),
  ('scan','Scan to Pay','Money','/scan',100),
  ('trade','Trade / Exchange','Markets','/trade',110),
  ('tokens','Tokens','Markets','/tokens',120),
  ('opentoken','OpenToken','Markets','/opentoken',130),
  ('p2p','P2P Marketplace','Markets','/p2p',140),
  ('watchlist','Watchlist','Markets','/watchlist',150),
  ('nfts','NFTs','Collectibles','/nfts',160),
  ('bags','Bags','Collectibles','/bags',170),
  ('airdrop','Airdrop','Rewards','/airdrop',180),
  ('ai','OpenPay AI','Tools','/ai',190),
  ('chat','Chat','Tools','/chat',200),
  ('activity','Activity / History','Tools','/activity',210),
  ('kyc','KYC Verification','Account','/kyc',220),
  ('profile','Profile','Account','/profile',230),
  ('ledger','Ledger','Developer','/ledger',240),
  ('developer','Developer Portal','Developer','/developer',250),
  ('partner_api','Partner API','Developer','/partner-api',260),
  ('connect','Agent Connect','Developer','/connect',270),
  ('solana_pay','Solana Pay','Integrations','/solana-pay',280),
  ('trust_wallet','Trust Wallet','Integrations','/trust-wallet',290),
  ('metamask','MetaMask','Integrations','/metamask',300),
  ('wc_pay','WalletConnect Pay','Integrations','/wc-pay',310)
ON CONFLICT (feature_key) DO NOTHING;