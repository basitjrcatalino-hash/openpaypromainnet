alter table public.wallets
  add column if not exists opro_balance numeric(38, 12) not null default 0;

comment on column public.wallets.opro_balance is 'OpenPay Pro ledger OPRO — network asset tracking SOL price';

create or replace function public.p2p_balance_column(_asset text)
returns text
language sql
immutable
set search_path = public
as $$
  select case upper(coalesce(_asset, ''))
    when 'OUSD' then 'ousd_balance'
    when 'OPRO' then 'opro_balance'
    when 'BTC' then 'btc_balance'
    when 'ETH' then 'eth_balance'
    when 'SOL' then 'sol_balance'
    when 'PI' then 'pi_balance'
    when 'USDC' then 'usdc_balance'
    when 'USDT' then 'usdt_balance'
    when 'PYUSD' then 'pyusd_balance'
    when 'USDG' then 'usdg_balance'
    when 'USD1' then 'usd1_balance'
    when 'CASH' then 'cash_balance'
    when 'EURC' then 'eurc_balance'
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
    when 'USDY' then 'usdy_balance'
    when 'PAXG' then 'paxg_balance'
    when 'WLFI' then 'wlfi_balance'
    when 'ASTER' then 'aster_balance'
    when 'RLUSD' then 'rlusd_balance'
    when 'AAVE' then 'aave_balance'
    when 'DOT' then 'dot_balance'
    when 'PUMP' then 'pump_balance'
    when 'WBTC' then 'wbtc_balance'
    when 'LEO' then 'leo_balance'
    when 'SHIB' then 'shib_balance'
    when 'LTC' then 'ltc_balance'
    when 'HBAR' then 'hbar_balance'
    when 'PEPE' then 'pepe_balance'
    when 'XMR' then 'xmr_balance'
    when 'APT' then 'apt_balance'
    when 'TAO' then 'tao_balance'
    when 'ICP' then 'icp_balance'
    when 'ETC' then 'etc_balance'
    when 'CRO' then 'cro_balance'
    when 'MNT' then 'mnt_balance'
    when 'POL' then 'pol_balance'
    when 'VET' then 'vet_balance'
    when 'ALGO' then 'algo_balance'
    when 'FIL' then 'fil_balance'
    when 'RENDER' then 'render_balance'
    when 'ATOM' then 'atom_balance'
    when 'ARB' then 'arb_balance'
    when 'OP' then 'op_balance'
    when 'INJ' then 'inj_balance'
    when 'SEI' then 'sei_balance'
    when 'FET' then 'fet_balance'
    when 'KAS' then 'kas_balance'
    when 'BONK' then 'bonk_balance'
    when 'WIF' then 'wif_balance'
    when 'ENA' then 'ena_balance'
    when 'PYTH' then 'pyth_balance'
    when 'PENDLE' then 'pendle_balance'
    when 'SAND' then 'sand_balance'
    when 'MANA' then 'mana_balance'
    when 'GRT' then 'grt_balance'
    when 'THETA' then 'theta_balance'
    when 'FLOW' then 'flow_balance'
    when 'EOS' then 'eos_balance'
    when 'EGLD' then 'egld_balance'
    when 'QNT' then 'qnt_balance'
    when 'STX' then 'stx_balance'
    when 'XDC' then 'xdc_balance'
    when 'NEXO' then 'nexo_balance'
    when 'BSV' then 'bsv_balance'
    when 'IMX' then 'imx_balance'
    when 'RUNE' then 'rune_balance'
    when 'KCS' then 'kcs_balance'
    when 'FLR' then 'flr_balance'
    when 'MKR' then 'mkr_balance'
    when 'CRV' then 'crv_balance'
    when 'COMP' then 'comp_balance'
    when 'SNX' then 'snx_balance'
    when 'LDO' then 'ldo_balance'
    when 'AXS' then 'axs_balance'
    when 'GALA' then 'gala_balance'
    when 'CHZ' then 'chz_balance'
    when 'IOTA' then 'iota_balance'
    when 'ROSE' then 'rose_balance'
    when 'KAVA' then 'kava_balance'
    when 'MINA' then 'mina_balance'
    when 'DASH' then 'dash_balance'
    when 'NEO' then 'neo_balance'
    when 'SFP' then 'sfp_balance'
    when 'TWT' then 'twt_balance'
    when 'ZRO' then 'zro_balance'
    when 'STRK' then 'strk_balance'
    when 'AERO' then 'aero_balance'
    when 'VIRTUAL' then 'virtual_balance'
    when 'BEAM' then 'beam_balance'
    when 'AKT' then 'akt_balance'
    when 'NOT' then 'not_balance'
    when 'BLUR' then 'blur_balance'
    when 'CELO' then 'celo_balance'
    when 'ORDI' then 'ordi_balance'
    when 'BRETT' then 'brett_balance'
    when 'BABYDOGE' then 'babydoge_balance'
    when 'WBT' then 'wbt_balance'
    when 'RAIN' then 'rain_balance'
    when 'CC' then 'cc_balance'
    when 'HTX' then 'htx_balance'
    when 'M' then 'm_balance'
    when 'SKY' then 'sky_balance'
    when 'MORPHO' then 'morpho_balance'
    when 'WLD' then 'wld_balance'
    when 'JST' then 'jst_balance'
    when 'STABLE' then 'stable_balance'
    when 'BEAT' then 'beat_balance'
    when 'BDX' then 'bdx_balance'
    when 'VVV' then 'vvv_balance'
    when 'LIT' then 'lit_balance'
    when 'PENGU' then 'pengu_balance'
    when 'TRUMP' then 'trump_balance'
    when 'ETHFI' then 'ethfi_balance'
    when 'SUN' then 'sun_balance'
    when 'NIGHT' then 'night_balance'
    when 'TIA' then 'tia_balance'
    when 'SPX' then 'spx_balance'
    when 'LUNC' then 'lunc_balance'
    when 'GNO' then 'gno_balance'
    when 'ROBO' then 'robo_balance'
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

  return jsonb_build_object(
    'wallet_id', wid,
    'funding', funding,
    'trading', trading,
    'p2p', p2p
  );
end;
$$;

grant execute on function public.get_account_portfolio() to authenticated;