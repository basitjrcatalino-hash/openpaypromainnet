
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- WALLETS
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  ousd_balance NUMERIC(38,8) NOT NULL DEFAULT 0,
  pi_balance NUMERIC(38,8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX wallets_user_id_idx ON public.wallets(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets_owner_all" ON public.wallets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TOKENS (publicly viewable marketplace)
CREATE TABLE public.tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  total_supply NUMERIC(38,8) NOT NULL DEFAULT 0,
  decimals INTEGER NOT NULL DEFAULT 18,
  contract_address TEXT UNIQUE,
  website TEXT,
  twitter TEXT,
  telegram TEXT,
  burnable BOOLEAN NOT NULL DEFAULT false,
  mintable BOOLEAN NOT NULL DEFAULT false,
  pausable BOOLEAN NOT NULL DEFAULT false,
  tax_bps INTEGER NOT NULL DEFAULT 0,
  auto_liquidity BOOLEAN NOT NULL DEFAULT false,
  price_usd NUMERIC(38,8) NOT NULL DEFAULT 0,
  change_24h NUMERIC(10,4) NOT NULL DEFAULT 0,
  volume_24h NUMERIC(38,2) NOT NULL DEFAULT 0,
  market_cap NUMERIC(38,2) NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tokens_creator_idx ON public.tokens(creator_id);
GRANT SELECT ON public.tokens TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tokens TO authenticated;
GRANT ALL ON public.tokens TO service_role;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tokens_public_select" ON public.tokens FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tokens_creator_insert" ON public.tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "tokens_creator_update" ON public.tokens FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "tokens_creator_delete" ON public.tokens FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- TOKEN HOLDINGS
CREATE TABLE public.token_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  balance NUMERIC(38,8) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(wallet_id, token_id)
);
CREATE INDEX holdings_wallet_idx ON public.token_holdings(wallet_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.token_holdings TO authenticated;
GRANT ALL ON public.token_holdings TO service_role;
ALTER TABLE public.token_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holdings_owner_all" ON public.token_holdings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_id AND w.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_id AND w.user_id = auth.uid()));

-- TRANSACTIONS
CREATE TYPE public.tx_type AS ENUM ('send','receive','swap','mint','buy','sell','reward');
CREATE TYPE public.tx_status AS ENUM ('pending','confirmed','failed');
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  type public.tx_type NOT NULL,
  status public.tx_status NOT NULL DEFAULT 'confirmed',
  token_symbol TEXT,
  token_id UUID REFERENCES public.tokens(id) ON DELETE SET NULL,
  counterparty TEXT,
  amount NUMERIC(38,8) NOT NULL DEFAULT 0,
  usd_value NUMERIC(38,2) NOT NULL DEFAULT 0,
  tx_hash TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tx_wallet_idx ON public.transactions(wallet_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_owner_all" ON public.transactions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_id AND w.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_id AND w.user_id = auth.uid()));

-- NFT COLLECTIONS (publicly viewable)
CREATE TABLE public.nft_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  website TEXT,
  twitter TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  floor_price NUMERIC(38,8) NOT NULL DEFAULT 0,
  total_volume NUMERIC(38,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nft_collections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.nft_collections TO authenticated;
GRANT ALL ON public.nft_collections TO service_role;
ALTER TABLE public.nft_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collections_public_select" ON public.nft_collections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "collections_creator_write" ON public.nft_collections FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "collections_creator_update" ON public.nft_collections FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "collections_creator_delete" ON public.nft_collections FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- NFTS
CREATE TABLE public.nfts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES public.nft_collections(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  price NUMERIC(38,8) NOT NULL DEFAULT 0,
  royalty_bps INTEGER NOT NULL DEFAULT 500,
  listed BOOLEAN NOT NULL DEFAULT false,
  minted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX nfts_collection_idx ON public.nfts(collection_id);
CREATE INDEX nfts_owner_idx ON public.nfts(owner_wallet_id);
GRANT SELECT ON public.nfts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.nfts TO authenticated;
GRANT ALL ON public.nfts TO service_role;
ALTER TABLE public.nfts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nfts_public_select" ON public.nfts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "nfts_owner_or_creator_insert" ON public.nfts FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "nfts_owner_update" ON public.nfts FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id OR EXISTS(SELECT 1 FROM public.wallets w WHERE w.id = owner_wallet_id AND w.user_id = auth.uid()))
  WITH CHECK (auth.uid() = creator_id OR EXISTS(SELECT 1 FROM public.wallets w WHERE w.id = owner_wallet_id AND w.user_id = auth.uid()));
CREATE POLICY "nfts_creator_delete" ON public.nfts FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- NFT TRANSACTIONS
CREATE TABLE public.nft_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nft_id UUID NOT NULL REFERENCES public.nfts(id) ON DELETE CASCADE,
  from_wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  to_wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  price NUMERIC(38,8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nft_transactions TO anon, authenticated;
GRANT INSERT ON public.nft_transactions TO authenticated;
GRANT ALL ON public.nft_transactions TO service_role;
ALTER TABLE public.nft_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nft_tx_public_select" ON public.nft_transactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "nft_tx_owner_insert" ON public.nft_transactions FOR INSERT TO authenticated WITH CHECK (
  (from_wallet_id IS NULL OR EXISTS(SELECT 1 FROM public.wallets w WHERE w.id = from_wallet_id AND w.user_id = auth.uid()))
  OR (to_wallet_id IS NULL OR EXISTS(SELECT 1 FROM public.wallets w WHERE w.id = to_wallet_id AND w.user_id = auth.uid()))
);

-- USER PREFERENCES
CREATE TABLE public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'dark',
  currency TEXT NOT NULL DEFAULT 'USD',
  language TEXT NOT NULL DEFAULT 'en',
  notifications JSONB NOT NULL DEFAULT '{"price_alerts":true,"transactions":true,"nft":true}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefs_self_all" ON public.user_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-create profile + preferences on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed marketplace tokens (public reference data, creator_id NULL)
INSERT INTO public.tokens (name, symbol, logo_url, description, total_supply, decimals, price_usd, change_24h, volume_24h, market_cap, is_featured) VALUES
('OpenPay USD','OUSD',NULL,'OpenPay stablecoin pegged 1:1 to USD',1000000000,6,1.00,0.01,12500000,1000000000,true),
('Pi Network','PI',NULL,'Pi Network token',100000000,8,32.50,4.21,8500000,3250000000,true),
('Ethereum','ETH',NULL,'Native asset of Ethereum',120000000,18,3450.20,2.15,18500000000,414024000000,true),
('Solana','SOL',NULL,'High-performance L1',570000000,9,182.34,5.62,2400000000,103933800000,true),
('OpenPay','OPAY',NULL,'OpenPay ecosystem governance token',500000000,18,4.85,8.32,1250000,2425000000,true),
('Bitcoin','BTC',NULL,'Bitcoin wrapped',21000000,8,98245.10,1.45,32500000000,2063147100000,false),
('Tether','USDT',NULL,'Tether stablecoin',95000000000,6,1.00,0.00,45000000000,95000000000,false),
('Lovable','LVBL',NULL,'Community meme',1000000000,18,0.0245,15.4,450000,24500000,false);

-- Seed sample NFT collections
INSERT INTO public.nft_collections (name, slug, description, is_featured, floor_price, total_volume) VALUES
('OpenPay Genesis','openpay-genesis','First-edition OpenPay membership passes',true,2.5,18540),
('Pixel Pioneers','pixel-pioneers','Retro pixel art collection',true,0.85,9230),
('Crypto Punks Lite','cp-lite','Tribute punk collection',false,1.2,4521);
