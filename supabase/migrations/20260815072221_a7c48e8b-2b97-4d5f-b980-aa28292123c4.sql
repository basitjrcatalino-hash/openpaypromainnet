CREATE OR REPLACE FUNCTION public.get_account_portfolio()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  wid uuid;
  w record;
  funding jsonb := '{}'::jsonb;
  trading jsonb := '{}'::jsonb;
  p2p jsonb := '{}'::jsonb;
  spot jsonb := '{}'::jsonb;
  r record;
  col text;
  assets text[] := array[
    'OUSD','OPRO','BTC','ETH','SOL','PI','USDC','USDT','PYUSD','USDG','USD1','CASH','EURC','HYPE','ZEC','TSLAX','NFLXX','GOOGLX','BNB','UNI','OKB','GT','BGB','CAKE','JUP','RON','XRP','TRX','DOGE','ADA','LINK','XLM','BCH','GRAM','AVAX','SUI','XAUT','ONDO','NEAR','USDY','PAXG','WLFI','ASTER','RLUSD','AAVE','DOT','PUMP','WBTC','LEO','SHIB','LTC','HBAR','PEPE','XMR','APT','TAO','ICP','ETC','CRO','MNT','POL','VET','ALGO','FIL','RENDER','ATOM','ARB','OP','INJ','SEI','FET','KAS','BONK','WIF','ENA','PYTH','PENDLE','SAND','MANA','GRT','THETA','FLOW','EOS','EGLD','QNT','STX','XDC','NEXO','BSV','IMX','RUNE','KCS','FLR','MKR','CRV','COMP','SNX','LDO','AXS','GALA','CHZ','IOTA','ROSE','KAVA','MINA','DASH','NEO','SFP','TWT','ZRO','STRK','AERO','VIRTUAL','BEAM','AKT','NOT','BLUR','CELO','ORDI','BRETT','BABYDOGE','WBT','RAIN','CC','HTX','M','SKY','MORPHO','WLD','JST','STABLE','BEAT','BDX','VVV','LIT','PENGU','TRUMP','ETHFI','SUN','NIGHT','TIA','SPX','LUNC','GNO','ROBO'
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
      'p2p', p2p,
      'spot', spot
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
    where wallet_id = wid and account in ('trading', 'p2p', 'spot')
  loop
    if r.account = 'trading' then
      trading := trading || jsonb_build_object(upper(r.asset), r.balance);
    elsif r.account = 'spot' then
      spot := spot || jsonb_build_object(upper(r.asset), r.balance);
    else
      p2p := p2p || jsonb_build_object(upper(r.asset), r.balance);
    end if;
  end loop;

  return jsonb_build_object(
    'wallet_id', wid,
    'funding', funding,
    'trading', trading,
    'p2p', p2p,
    'spot', spot
  );
end;
$function$;