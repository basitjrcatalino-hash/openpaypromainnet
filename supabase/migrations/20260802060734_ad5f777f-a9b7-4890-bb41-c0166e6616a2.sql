-- 1) Additional networks
INSERT INTO public.deposit_chains (key, name, family, chain_id, explorer_url, required_confirmations, bridge_status, is_enabled, maintenance_mode, sort_order)
SELECT v.key, v.name, v.family, v.chain_id, v.explorer_url, v.confs, 'native', true, false, v.sort
FROM (VALUES
  ('tron','TRON','tron',NULL::int,'https://tronscan.org/#/transaction/',20,90),
  ('bitcoin','Bitcoin','bitcoin',NULL,'https://mempool.space/tx/',2,91),
  ('xrp','XRP Ledger','xrp',NULL,'https://xrpscan.com/tx/',1,92),
  ('pi','Pi Network','pi',NULL,'https://blockexplorer.minepi.com/mainnet/transactions/',1,93),
  ('ton','TON','ton',NULL,'https://tonviewer.com/transaction/',1,94),
  ('litecoin','Litecoin','litecoin',NULL,'https://blockchair.com/litecoin/transaction/',6,95),
  ('dogecoin','Dogecoin','dogecoin',NULL,'https://blockchair.com/dogecoin/transaction/',10,96)
) AS v(key,name,family,chain_id,explorer_url,confs,sort)
WHERE NOT EXISTS (SELECT 1 FROM public.deposit_chains c WHERE c.key = v.key);

-- 2) Token catalog
WITH v(chain_key, symbol, name, contract, dec, min_dep, sort) AS (VALUES
  -- Ethereum
  ('ethereum','ETH','Ethereum',NULL,18,0.001,10),
  ('ethereum','USDT','Tether','0xdac17f958d2ee523a2206206994597c13d831ec7',6,1,11),
  ('ethereum','USDC','USD Coin','0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',6,1,12),
  ('ethereum','WBTC','Wrapped Bitcoin','0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',8,0.0001,13),
  ('ethereum','XAUT','Tether Gold','0x68749665ff8d2d112fa859aa293f07a622782f38',6,0.001,14),
  ('ethereum','LINK','Chainlink','0x514910771af9ca656af840dff83e8264ecf986ca',18,0.1,15),
  ('ethereum','UNI','Uniswap','0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',18,0.1,16),
  ('ethereum','AAVE','Aave','0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',18,0.01,17),
  ('ethereum','SHIB','Shiba Inu','0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',18,100000,18),
  ('ethereum','PEPE','Pepe','0x6982508145454ce325ddbe47a25d4ec3d2311933',18,100000,19),
  ('ethereum','1INCH','1inch','0x111111111117dc0aa78b770fa6a738034120c302',18,1,20),
  ('ethereum','DAI','Dai','0x6b175474e89094c44da98b954eedeac495271d0f',18,1,21),
  -- Base
  ('base','ETH','Ethereum',NULL,18,0.0005,30),
  ('base','USDC','USD Coin','0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',6,1,31),
  ('base','CBBTC','Coinbase Wrapped BTC','0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',8,0.0001,32),
  -- Arbitrum
  ('arbitrum','ETH','Ethereum',NULL,18,0.0005,40),
  ('arbitrum','USDT','Tether','0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',6,1,41),
  ('arbitrum','ARB','Arbitrum','0x912ce59144191c1204e64559fe8253a0e49e6548',18,1,42),
  -- Optimism
  ('optimism','ETH','Ethereum',NULL,18,0.0005,50),
  ('optimism','OP','Optimism','0x4200000000000000000000000000000000000042',18,1,51),
  -- Polygon
  ('polygon','POL','Polygon',NULL,18,1,60),
  ('polygon','USDT','Tether','0xc2132d05d31c914a87c6611c10748aeb04b58e8f',6,1,61),
  -- BNB Chain
  ('bnb','BNB','BNB',NULL,18,0.001,70),
  ('bnb','USDC','USD Coin','0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',18,1,71),
  ('bnb','CAKE','PancakeSwap','0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',18,0.1,72),
  -- Avalanche
  ('avalanche','AVAX','Avalanche',NULL,18,0.01,80),
  ('avalanche','USDT','Tether','0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',6,1,81),
  -- Solana
  ('solana','USDT','Tether','Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',6,1,100),
  ('solana','JUP','Jupiter','JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',6,1,101),
  ('solana','BONK','Bonk','DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',5,100000,102),
  -- TRON
  ('tron','TRX','TRON',NULL,6,1,110),
  ('tron','USDT','Tether','TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',6,1,111),
  -- Bitcoin / XRP / Pi / TON / LTC / DOGE
  ('bitcoin','BTC','Bitcoin',NULL,8,0.0001,120),
  ('xrp','XRP','XRP',NULL,6,1,130),
  ('pi','PI','Pi Network',NULL,7,0.00000001,140),
  ('ton','TON','Toncoin',NULL,9,0.1,150),
  ('litecoin','LTC','Litecoin',NULL,8,0.01,160),
  ('dogecoin','DOGE','Dogecoin',NULL,8,5,170)
)
INSERT INTO public.deposit_tokens
  (chain_id, symbol, name, contract_address, decimals, min_deposit, sort_order,
   deposit_enabled, withdrawal_enabled, status, credit_symbol)
SELECT c.id, v.symbol, v.name, v.contract, v.dec, v.min_dep, v.sort, true, true, 'active', 'OUSD'
FROM v
JOIN public.deposit_chains c ON c.key = v.chain_key
WHERE NOT EXISTS (
  SELECT 1 FROM public.deposit_tokens t
  WHERE t.chain_id = c.id AND upper(t.symbol) = upper(v.symbol)
);

-- 3) Enable deposits on everything already configured
UPDATE public.deposit_tokens
SET deposit_enabled = true, status = 'active'
WHERE status <> 'delisted';

-- 4) Sample receive address per network (chain-wide; edit in Admin -> Deposits)
INSERT INTO public.deposit_addresses (chain_id, token_id, address, label, memo_tag, is_active)
SELECT c.id, NULL, v.address, 'Sample - edit in admin', v.memo, true
FROM (VALUES
  ('ethereum','0xc847682465ea537c3957cd46eff2c7229faefde1',NULL::text),
  ('base','0xc847682465ea537c3957cd46eff2c7229faefde1',NULL),
  ('arbitrum','0xc847682465ea537c3957cd46eff2c7229faefde1',NULL),
  ('optimism','0xc847682465ea537c3957cd46eff2c7229faefde1',NULL),
  ('polygon','0xc847682465ea537c3957cd46eff2c7229faefde1',NULL),
  ('bnb','0xc847682465ea537c3957cd46eff2c7229faefde1',NULL),
  ('avalanche','0xc847682465ea537c3957cd46eff2c7229faefde1',NULL),
  ('solana','D4eKtnAjuLKX3rVs3xE76ZjqCZtLDRxQeKer9ZpijiWK',NULL),
  ('tron','TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',NULL),
  ('bitcoin','bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',NULL),
  ('xrp','rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh','100001'),
  ('pi','MALYJFJ5SVD45FBWN2GT4IW67SEZ3IBOFSBSPUFCWV427NBNLG3PWAAAAAAAAAA2TSI4K2',NULL),
  ('ton','UQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI',NULL),
  ('litecoin','ltc1qh2egksgfejqpktc3kkdtuqqrukmqlz9tk4y5ry',NULL),
  ('dogecoin','DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L',NULL)
) AS v(chain_key, address, memo)
JOIN public.deposit_chains c ON c.key = v.chain_key
WHERE NOT EXISTS (
  SELECT 1 FROM public.deposit_addresses a WHERE a.chain_id = c.id AND a.token_id IS NULL
);