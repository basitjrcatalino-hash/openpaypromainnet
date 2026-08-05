-- Expand OpenPay Pro wallet ledger balances for all Spot/Perp listed majors.
-- Enables buy / hold / spot settlement for every Tokens catalog major.

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS wbtc_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leo_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shib_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ltc_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hbar_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pepe_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xmr_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS apt_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tao_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icp_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS etc_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cro_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mnt_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pol_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vet_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS algo_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fil_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS render_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS atom_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arb_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS op_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inj_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sei_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fet_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kas_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonk_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wif_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ena_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pyth_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pendle_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sand_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mana_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grt_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS theta_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flow_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eos_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS egld_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qnt_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stx_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xdc_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nexo_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bsv_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imx_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rune_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kcs_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flr_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mkr_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS crv_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comp_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS snx_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ldo_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS axs_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gala_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chz_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iota_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rose_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kava_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mina_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dash_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS neo_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sfp_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS twt_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS zro_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS strk_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aero_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS virtual_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS beam_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS akt_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS not_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blur_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS celo_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ordi_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brett_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS babydoge_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wbt_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rain_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cc_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS htx_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS m_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sky_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS morpho_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wld_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jst_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stable_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS beat_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bdx_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vvv_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lit_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pengu_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trump_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ethfi_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sun_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS night_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tia_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spx_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lunc_balance NUMERIC(38, 12) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gno_balance NUMERIC(38, 12) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.wallets.wbtc_balance IS 'OpenPay Pro ledger WBTC — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.leo_balance IS 'OpenPay Pro ledger LEO — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.shib_balance IS 'OpenPay Pro ledger SHIB — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.ltc_balance IS 'OpenPay Pro ledger LTC — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.hbar_balance IS 'OpenPay Pro ledger HBAR — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.pepe_balance IS 'OpenPay Pro ledger PEPE — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.xmr_balance IS 'OpenPay Pro ledger XMR — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.apt_balance IS 'OpenPay Pro ledger APT — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.tao_balance IS 'OpenPay Pro ledger TAO — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.icp_balance IS 'OpenPay Pro ledger ICP — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.etc_balance IS 'OpenPay Pro ledger ETC — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.cro_balance IS 'OpenPay Pro ledger CRO — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.mnt_balance IS 'OpenPay Pro ledger MNT — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.pol_balance IS 'OpenPay Pro ledger POL — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.vet_balance IS 'OpenPay Pro ledger VET — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.algo_balance IS 'OpenPay Pro ledger ALGO — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.fil_balance IS 'OpenPay Pro ledger FIL — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.render_balance IS 'OpenPay Pro ledger RENDER — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.atom_balance IS 'OpenPay Pro ledger ATOM — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.arb_balance IS 'OpenPay Pro ledger ARB — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.op_balance IS 'OpenPay Pro ledger OP — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.inj_balance IS 'OpenPay Pro ledger INJ — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.sei_balance IS 'OpenPay Pro ledger SEI — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.fet_balance IS 'OpenPay Pro ledger FET — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.kas_balance IS 'OpenPay Pro ledger KAS — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.bonk_balance IS 'OpenPay Pro ledger BONK — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.wif_balance IS 'OpenPay Pro ledger WIF — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.ena_balance IS 'OpenPay Pro ledger ENA — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.pyth_balance IS 'OpenPay Pro ledger PYTH — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.pendle_balance IS 'OpenPay Pro ledger PENDLE — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.sand_balance IS 'OpenPay Pro ledger SAND — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.mana_balance IS 'OpenPay Pro ledger MANA — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.grt_balance IS 'OpenPay Pro ledger GRT — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.theta_balance IS 'OpenPay Pro ledger THETA — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.flow_balance IS 'OpenPay Pro ledger FLOW — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.eos_balance IS 'OpenPay Pro ledger EOS — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.egld_balance IS 'OpenPay Pro ledger EGLD — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.qnt_balance IS 'OpenPay Pro ledger QNT — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.stx_balance IS 'OpenPay Pro ledger STX — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.xdc_balance IS 'OpenPay Pro ledger XDC — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.nexo_balance IS 'OpenPay Pro ledger NEXO — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.bsv_balance IS 'OpenPay Pro ledger BSV — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.imx_balance IS 'OpenPay Pro ledger IMX — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.rune_balance IS 'OpenPay Pro ledger RUNE — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.kcs_balance IS 'OpenPay Pro ledger KCS — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.flr_balance IS 'OpenPay Pro ledger FLR — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.mkr_balance IS 'OpenPay Pro ledger MKR — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.crv_balance IS 'OpenPay Pro ledger CRV — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.comp_balance IS 'OpenPay Pro ledger COMP — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.snx_balance IS 'OpenPay Pro ledger SNX — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.ldo_balance IS 'OpenPay Pro ledger LDO — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.axs_balance IS 'OpenPay Pro ledger AXS — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.gala_balance IS 'OpenPay Pro ledger GALA — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.chz_balance IS 'OpenPay Pro ledger CHZ — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.iota_balance IS 'OpenPay Pro ledger IOTA — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.rose_balance IS 'OpenPay Pro ledger ROSE — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.kava_balance IS 'OpenPay Pro ledger KAVA — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.mina_balance IS 'OpenPay Pro ledger MINA — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.dash_balance IS 'OpenPay Pro ledger DASH — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.neo_balance IS 'OpenPay Pro ledger NEO — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.sfp_balance IS 'OpenPay Pro ledger SFP — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.twt_balance IS 'OpenPay Pro ledger TWT — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.zro_balance IS 'OpenPay Pro ledger ZRO — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.strk_balance IS 'OpenPay Pro ledger STRK — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.aero_balance IS 'OpenPay Pro ledger AERO — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.virtual_balance IS 'OpenPay Pro ledger VIRTUAL — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.beam_balance IS 'OpenPay Pro ledger BEAM — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.akt_balance IS 'OpenPay Pro ledger AKT — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.not_balance IS 'OpenPay Pro ledger NOT — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.blur_balance IS 'OpenPay Pro ledger BLUR — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.celo_balance IS 'OpenPay Pro ledger CELO — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.ordi_balance IS 'OpenPay Pro ledger ORDI — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.brett_balance IS 'OpenPay Pro ledger BRETT — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.babydoge_balance IS 'OpenPay Pro ledger BABYDOGE — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.wbt_balance IS 'OpenPay Pro ledger WBT — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.rain_balance IS 'OpenPay Pro ledger RAIN — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.cc_balance IS 'OpenPay Pro ledger CC — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.htx_balance IS 'OpenPay Pro ledger HTX — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.m_balance IS 'OpenPay Pro ledger M — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.sky_balance IS 'OpenPay Pro ledger SKY — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.morpho_balance IS 'OpenPay Pro ledger MORPHO — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.wld_balance IS 'OpenPay Pro ledger WLD — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.jst_balance IS 'OpenPay Pro ledger JST — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.stable_balance IS 'OpenPay Pro ledger STABLE — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.beat_balance IS 'OpenPay Pro ledger BEAT — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.bdx_balance IS 'OpenPay Pro ledger BDX — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.vvv_balance IS 'OpenPay Pro ledger VVV — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.lit_balance IS 'OpenPay Pro ledger LIT — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.pengu_balance IS 'OpenPay Pro ledger PENGU — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.trump_balance IS 'OpenPay Pro ledger TRUMP — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.ethfi_balance IS 'OpenPay Pro ledger ETHFI — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.sun_balance IS 'OpenPay Pro ledger SUN — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.night_balance IS 'OpenPay Pro ledger NIGHT — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.tia_balance IS 'OpenPay Pro ledger TIA — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.spx_balance IS 'OpenPay Pro ledger SPX — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.lunc_balance IS 'OpenPay Pro ledger LUNC — Spot/Perp listed major';
COMMENT ON COLUMN public.wallets.gno_balance IS 'OpenPay Pro ledger GNO — Spot/Perp listed major';

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
    else null end
$$;

-- Soften Spot/Perp market CHECKs already widened; ensure funding tables accept symbols.
create or replace function public.is_trade_market_symbol(m text)
returns boolean
language sql
immutable
as $$
  select upper(coalesce(m, '')) ~ '^[A-Z0-9]{1,16}$';
$$;

-- Refresh funding portfolio snapshot for all ledger majors
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
    'OUSD','BTC','ETH','SOL','PI','USDC','USDT','PYUSD','USDG','USD1','CASH','EURC','HYPE','ZEC','TSLAX','NFLXX','GOOGLX','BNB','UNI','OKB','GT','BGB','CAKE','JUP','RON','XRP','TRX','DOGE','ADA','LINK','XLM','BCH','GRAM','AVAX','SUI','XAUT','ONDO','NEAR','USDY','PAXG','WLFI','ASTER','RLUSD','AAVE','DOT','PUMP','WBTC','LEO','SHIB','LTC','HBAR','PEPE','XMR','APT','TAO','ICP','ETC','CRO','MNT','POL','VET','ALGO','FIL','RENDER','ATOM','ARB','OP','INJ','SEI','FET','KAS','BONK','WIF','ENA','PYTH','PENDLE','SAND','MANA','GRT','THETA','FLOW','EOS','EGLD','QNT','STX','XDC','NEXO','BSV','IMX','RUNE','KCS','FLR','MKR','CRV','COMP','SNX','LDO','AXS','GALA','CHZ','IOTA','ROSE','KAVA','MINA','DASH','NEO','SFP','TWT','ZRO','STRK','AERO','VIRTUAL','BEAM','AKT','NOT','BLUR','CELO','ORDI','BRETT','BABYDOGE','WBT','RAIN','CC','HTX','M','SKY','MORPHO','WLD','JST','STABLE','BEAT','BDX','VVV','LIT','PENGU','TRUMP','ETHFI','SUN','NIGHT','TIA','SPX','LUNC','GNO'
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
