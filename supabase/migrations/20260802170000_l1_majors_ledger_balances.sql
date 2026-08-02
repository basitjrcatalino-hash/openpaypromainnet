-- Custodial OpenPay Pro ledger balances for additional L1 majors.
-- CoinGecko: ripple, tron, dogecoin, cardano, chainlink, stellar, bitcoin-cash

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS xrp_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trx_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doge_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ada_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xlm_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bch_balance NUMERIC(38, 12) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.wallets.xrp_balance IS 'OpenPay Pro ledger XRP — CoinGecko ripple';
COMMENT ON COLUMN public.wallets.trx_balance IS 'OpenPay Pro ledger TRX — CoinGecko tron';
COMMENT ON COLUMN public.wallets.doge_balance IS 'OpenPay Pro ledger DOGE — CoinGecko dogecoin';
COMMENT ON COLUMN public.wallets.ada_balance IS 'OpenPay Pro ledger ADA — CoinGecko cardano';
COMMENT ON COLUMN public.wallets.link_balance IS 'OpenPay Pro ledger LINK — Ethereum 0x514910771af9ca656af840dff83e8264ecf986ca';
COMMENT ON COLUMN public.wallets.xlm_balance IS 'OpenPay Pro ledger XLM — CoinGecko stellar';
COMMENT ON COLUMN public.wallets.bch_balance IS 'OpenPay Pro ledger BCH — CoinGecko bitcoin-cash';

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
    'XRP','TRX','DOGE','ADA','LINK','XLM','BCH'
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
