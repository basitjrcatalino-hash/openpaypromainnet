-- Custodial OpenPay Pro ledger balances for GRAM / AVAX / SUI / XAUt / ONDO / NEAR.
-- CoinGecko: the-open-network, avalanche-2, sui, tether-gold, ondo-finance, near

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS gram_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avax_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sui_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xaut_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ondo_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS near_balance NUMERIC(38, 12) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.wallets.gram_balance IS 'OpenPay Pro ledger GRAM — CoinGecko the-open-network';
COMMENT ON COLUMN public.wallets.avax_balance IS 'OpenPay Pro ledger AVAX — CoinGecko avalanche-2';
COMMENT ON COLUMN public.wallets.sui_balance IS 'OpenPay Pro ledger SUI — CoinGecko sui';
COMMENT ON COLUMN public.wallets.xaut_balance IS 'OpenPay Pro ledger XAUt — Ethereum 0x68749665ff8d2d112fa859aa293f07a622782f38';
COMMENT ON COLUMN public.wallets.ondo_balance IS 'OpenPay Pro ledger ONDO — Ethereum 0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3';
COMMENT ON COLUMN public.wallets.near_balance IS 'OpenPay Pro ledger NEAR — CoinGecko near';

create or replace function public.p2p_balance_column(_asset text)
returns text
language sql
immutable
set search_path = public
as $$
  select case upper(_asset)
    when 'OUSD' then 'ousd_balance'
    when 'USDC' then 'usdc_balance'
    when 'USDT' then 'usdt_balance'
    when 'ETH'  then 'eth_balance'
    when 'BTC'  then 'btc_balance'
    when 'SOL'  then 'sol_balance'
    when 'PI'   then 'pi_balance'
    when 'PYUSD' then 'pyusd_balance'
    when 'EURC' then 'eurc_balance'
    when 'USDG' then 'usdg_balance'
    when 'USD1' then 'usd1_balance'
    when 'CASH' then 'cash_balance'
    when 'HYPE' then 'hype_balance'
    when 'ZEC' then 'zec_balance'
    when 'TSLAX' then 'tslax_balance'
    when 'NFLXX' then 'nflxx_balance'
    when 'GOOGLX' then 'googlx_balance'
    when 'BNB' then 'bnb_balance'
    when 'UNI' then 'uni_balance'
    when 'OKB' then 'okb_balance'
    when 'GT' then 'gt_balance'
    when 'BGB' then 'bgb_balance'
    when 'CAKE' then 'cake_balance'
    when 'JUP' then 'jup_balance'
    when 'RON' then 'ron_balance'
    when 'XRP' then 'xrp_balance'
    when 'TRX' then 'trx_balance'
    when 'DOGE' then 'doge_balance'
    when 'ADA' then 'ada_balance'
    when 'LINK' then 'link_balance'
    when 'XLM' then 'xlm_balance'
    when 'BCH' then 'bch_balance'
    when 'GRAM' then 'gram_balance'
    when 'AVAX' then 'avax_balance'
    when 'SUI' then 'sui_balance'
    when 'XAUT' then 'xaut_balance'
    when 'ONDO' then 'ondo_balance'
    when 'NEAR' then 'near_balance'
    else null end
$$;

create or replace function public.get_account_portfolio()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  wid uuid;
  w record;
  funding jsonb := '{}'::jsonb;
  trading jsonb := '{}'::jsonb;
  p2p jsonb := '{}'::jsonb;
  r record;
  col text;
  assets text[] := array[
    'OUSD','USDT','USDC','PYUSD','USDG','USD1','CASH','EURC',
    'ETH','BTC','SOL','PI','HYPE','ZEC','TSLAX','NFLXX','GOOGLX',
    'BNB','UNI','OKB','GT','BGB','CAKE','JUP','RON',
    'XRP','TRX','DOGE','ADA','LINK','XLM','BCH',
    'GRAM','AVAX','SUI','XAUT','ONDO','NEAR'
  ];
  a text;
  bal numeric;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into w
  from public.wallets
  where user_id = uid
  order by is_active desc, created_at asc
  limit 1;
  if w.id is null then
    return jsonb_build_object(
      'wallet_id', null,
      'funding', funding,
      'trading', trading,
      'p2p', p2p
    );
  end if;
  wid := w.id;

  foreach a in array assets loop
    col := public.p2p_balance_column(a);
    if col is null then continue; end if;
    execute format('select coalesce(%I, 0) from public.wallets where id = $1', col)
      into bal using wid;
    funding := funding || jsonb_build_object(a, bal);
  end loop;

  for r in
    select account, asset, balance
    from public.wallet_account_balances
    where wallet_id = wid and account in ('trading', 'p2p')
  loop
    if r.account = 'trading' then
      trading := trading || jsonb_build_object(upper(r.asset), r.balance);
    else
      p2p := p2p || jsonb_build_object(upper(r.asset), r.balance);
    end if;
  end loop;

  foreach a in array assets loop
    if not (trading ? a) then trading := trading || jsonb_build_object(a, 0); end if;
    if not (p2p ? a) then p2p := p2p || jsonb_build_object(a, 0); end if;
  end loop;

  return jsonb_build_object(
    'wallet_id', wid,
    'funding', funding,
    'trading', trading,
    'p2p', p2p
  );
end;
$$;

grant execute on function public.get_account_portfolio() to authenticated;
