/**
 * OpenPay Pro ledger majors — every Tokens catalog major is ledger-backed
 * (buy / hold / send / receive / Spot settlement). Prices via CoinGecko USD.
 */
import type { MajorTokenId } from "@/lib/major-tokens";
import { MAJOR_TOKENS, isMajorTokenId } from "@/lib/major-tokens";
import type { SwapNetworkId } from "@/lib/swap-networks";

export const OUSD_SWAP_ID = "__ousd__";
export const BTC_SWAP_ID = "__btc__";
export const ETH_SWAP_ID = "__eth__";
export const SOL_SWAP_ID = "__sol__";
export const PI_SWAP_ID = "__pi__";
export const USDC_SWAP_ID = "__usdc__";
export const USDT_SWAP_ID = "__usdt__";
export const PYUSD_SWAP_ID = "__pyusd__";
export const USDG_SWAP_ID = "__usdg__";
export const USD1_SWAP_ID = "__usd1__";
export const CASH_SWAP_ID = "__cash__";
export const EURC_SWAP_ID = "__eurc__";
export const HYPE_SWAP_ID = "__hype__";
export const ZEC_SWAP_ID = "__zec__";
export const TSLAX_SWAP_ID = "__tslax__";
export const NFLXX_SWAP_ID = "__nflxx__";
export const GOOGLX_SWAP_ID = "__googlx__";
export const BNB_SWAP_ID = "__bnb__";
export const UNI_SWAP_ID = "__uni__";
export const OKB_SWAP_ID = "__okb__";
export const GT_SWAP_ID = "__gt__";
export const BGB_SWAP_ID = "__bgb__";
export const CAKE_SWAP_ID = "__cake__";
export const JUP_SWAP_ID = "__jup__";
export const RON_SWAP_ID = "__ron__";
export const XRP_SWAP_ID = "__xrp__";
export const TRX_SWAP_ID = "__trx__";
export const DOGE_SWAP_ID = "__doge__";
export const ADA_SWAP_ID = "__ada__";
export const LINK_SWAP_ID = "__link__";
export const XLM_SWAP_ID = "__xlm__";
export const BCH_SWAP_ID = "__bch__";
export const GRAM_SWAP_ID = "__gram__";
export const AVAX_SWAP_ID = "__avax__";
export const SUI_SWAP_ID = "__sui__";
export const XAUT_SWAP_ID = "__xaut__";
export const ONDO_SWAP_ID = "__ondo__";
export const NEAR_SWAP_ID = "__near__";
export const USDY_SWAP_ID = "__usdy__";
export const PAXG_SWAP_ID = "__paxg__";
export const WLFI_SWAP_ID = "__wlfi__";
export const ASTER_SWAP_ID = "__aster__";
export const RLUSD_SWAP_ID = "__rlusd__";
export const AAVE_SWAP_ID = "__aave__";
export const DOT_SWAP_ID = "__dot__";
export const PUMP_SWAP_ID = "__pump__";
export const WBTC_SWAP_ID = "__wbtc__";
export const LEO_SWAP_ID = "__leo__";
export const SHIB_SWAP_ID = "__shib__";
export const LTC_SWAP_ID = "__ltc__";
export const HBAR_SWAP_ID = "__hbar__";
export const PEPE_SWAP_ID = "__pepe__";
export const XMR_SWAP_ID = "__xmr__";
export const APT_SWAP_ID = "__apt__";
export const TAO_SWAP_ID = "__tao__";
export const ICP_SWAP_ID = "__icp__";
export const ETC_SWAP_ID = "__etc__";
export const CRO_SWAP_ID = "__cro__";
export const MNT_SWAP_ID = "__mnt__";
export const POL_SWAP_ID = "__pol__";
export const VET_SWAP_ID = "__vet__";
export const ALGO_SWAP_ID = "__algo__";
export const FIL_SWAP_ID = "__fil__";
export const RENDER_SWAP_ID = "__render__";
export const ATOM_SWAP_ID = "__atom__";
export const ARB_SWAP_ID = "__arb__";
export const OP_SWAP_ID = "__op__";
export const INJ_SWAP_ID = "__inj__";
export const SEI_SWAP_ID = "__sei__";
export const FET_SWAP_ID = "__fet__";
export const KAS_SWAP_ID = "__kas__";
export const BONK_SWAP_ID = "__bonk__";
export const WIF_SWAP_ID = "__wif__";
export const ENA_SWAP_ID = "__ena__";
export const PYTH_SWAP_ID = "__pyth__";
export const PENDLE_SWAP_ID = "__pendle__";
export const SAND_SWAP_ID = "__sand__";
export const MANA_SWAP_ID = "__mana__";
export const GRT_SWAP_ID = "__grt__";
export const THETA_SWAP_ID = "__theta__";
export const FLOW_SWAP_ID = "__flow__";
export const EOS_SWAP_ID = "__eos__";
export const EGLD_SWAP_ID = "__egld__";
export const QNT_SWAP_ID = "__qnt__";
export const STX_SWAP_ID = "__stx__";
export const XDC_SWAP_ID = "__xdc__";
export const NEXO_SWAP_ID = "__nexo__";
export const BSV_SWAP_ID = "__bsv__";
export const IMX_SWAP_ID = "__imx__";
export const RUNE_SWAP_ID = "__rune__";
export const KCS_SWAP_ID = "__kcs__";
export const FLR_SWAP_ID = "__flr__";
export const MKR_SWAP_ID = "__mkr__";
export const CRV_SWAP_ID = "__crv__";
export const COMP_SWAP_ID = "__comp__";
export const SNX_SWAP_ID = "__snx__";
export const LDO_SWAP_ID = "__ldo__";
export const AXS_SWAP_ID = "__axs__";
export const GALA_SWAP_ID = "__gala__";
export const CHZ_SWAP_ID = "__chz__";
export const IOTA_SWAP_ID = "__iota__";
export const ROSE_SWAP_ID = "__rose__";
export const KAVA_SWAP_ID = "__kava__";
export const MINA_SWAP_ID = "__mina__";
export const DASH_SWAP_ID = "__dash__";
export const NEO_SWAP_ID = "__neo__";
export const SFP_SWAP_ID = "__sfp__";
export const TWT_SWAP_ID = "__twt__";
export const ZRO_SWAP_ID = "__zro__";
export const STRK_SWAP_ID = "__strk__";
export const AERO_SWAP_ID = "__aero__";
export const VIRTUAL_SWAP_ID = "__virtual__";
export const BEAM_SWAP_ID = "__beam__";
export const AKT_SWAP_ID = "__akt__";
export const NOT_SWAP_ID = "__not__";
export const BLUR_SWAP_ID = "__blur__";
export const CELO_SWAP_ID = "__celo__";
export const ORDI_SWAP_ID = "__ordi__";
export const BRETT_SWAP_ID = "__brett__";
export const BABYDOGE_SWAP_ID = "__babydoge__";
export const WBT_SWAP_ID = "__wbt__";
export const RAIN_SWAP_ID = "__rain__";
export const CC_SWAP_ID = "__cc__";
export const HTX_SWAP_ID = "__htx__";
export const M_SWAP_ID = "__m__";
export const SKY_SWAP_ID = "__sky__";
export const MORPHO_SWAP_ID = "__morpho__";
export const WLD_SWAP_ID = "__wld__";
export const JST_SWAP_ID = "__jst__";
export const STABLE_SWAP_ID = "__stable__";
export const BEAT_SWAP_ID = "__beat__";
export const BDX_SWAP_ID = "__bdx__";
export const VVV_SWAP_ID = "__vvv__";
export const LIT_SWAP_ID = "__lit__";
export const PENGU_SWAP_ID = "__pengu__";
export const TRUMP_SWAP_ID = "__trump__";
export const ETHFI_SWAP_ID = "__ethfi__";
export const SUN_SWAP_ID = "__sun__";
export const NIGHT_SWAP_ID = "__night__";
export const TIA_SWAP_ID = "__tia__";
export const SPX_SWAP_ID = "__spx__";
export const LUNC_SWAP_ID = "__lunc__";
export const GNO_SWAP_ID = "__gno__";
export const ROBO_SWAP_ID = "__robo__";

/** Ledger-backed majors — mirrors MAJOR_TOKENS (full catalog). */
export const LEDGER_MAJOR_SWAP_IDS = {
  btc: BTC_SWAP_ID,
  eth: ETH_SWAP_ID,
  sol: SOL_SWAP_ID,
  pi: PI_SWAP_ID,
  usdc: USDC_SWAP_ID,
  usdt: USDT_SWAP_ID,
  pyusd: PYUSD_SWAP_ID,
  usdg: USDG_SWAP_ID,
  usd1: USD1_SWAP_ID,
  cash: CASH_SWAP_ID,
  eurc: EURC_SWAP_ID,
  hype: HYPE_SWAP_ID,
  zec: ZEC_SWAP_ID,
  tslax: TSLAX_SWAP_ID,
  nflxx: NFLXX_SWAP_ID,
  googlx: GOOGLX_SWAP_ID,
  bnb: BNB_SWAP_ID,
  uni: UNI_SWAP_ID,
  okb: OKB_SWAP_ID,
  gt: GT_SWAP_ID,
  bgb: BGB_SWAP_ID,
  cake: CAKE_SWAP_ID,
  jup: JUP_SWAP_ID,
  ron: RON_SWAP_ID,
  xrp: XRP_SWAP_ID,
  trx: TRX_SWAP_ID,
  doge: DOGE_SWAP_ID,
  ada: ADA_SWAP_ID,
  link: LINK_SWAP_ID,
  xlm: XLM_SWAP_ID,
  bch: BCH_SWAP_ID,
  gram: GRAM_SWAP_ID,
  avax: AVAX_SWAP_ID,
  sui: SUI_SWAP_ID,
  xaut: XAUT_SWAP_ID,
  ondo: ONDO_SWAP_ID,
  near: NEAR_SWAP_ID,
  usdy: USDY_SWAP_ID,
  paxg: PAXG_SWAP_ID,
  wlfi: WLFI_SWAP_ID,
  aster: ASTER_SWAP_ID,
  rlusd: RLUSD_SWAP_ID,
  aave: AAVE_SWAP_ID,
  dot: DOT_SWAP_ID,
  pump: PUMP_SWAP_ID,
  wbtc: WBTC_SWAP_ID,
  leo: LEO_SWAP_ID,
  shib: SHIB_SWAP_ID,
  ltc: LTC_SWAP_ID,
  hbar: HBAR_SWAP_ID,
  pepe: PEPE_SWAP_ID,
  xmr: XMR_SWAP_ID,
  apt: APT_SWAP_ID,
  tao: TAO_SWAP_ID,
  icp: ICP_SWAP_ID,
  etc: ETC_SWAP_ID,
  cro: CRO_SWAP_ID,
  mnt: MNT_SWAP_ID,
  pol: POL_SWAP_ID,
  vet: VET_SWAP_ID,
  algo: ALGO_SWAP_ID,
  fil: FIL_SWAP_ID,
  render: RENDER_SWAP_ID,
  atom: ATOM_SWAP_ID,
  arb: ARB_SWAP_ID,
  op: OP_SWAP_ID,
  inj: INJ_SWAP_ID,
  sei: SEI_SWAP_ID,
  fet: FET_SWAP_ID,
  kas: KAS_SWAP_ID,
  bonk: BONK_SWAP_ID,
  wif: WIF_SWAP_ID,
  ena: ENA_SWAP_ID,
  pyth: PYTH_SWAP_ID,
  pendle: PENDLE_SWAP_ID,
  sand: SAND_SWAP_ID,
  mana: MANA_SWAP_ID,
  grt: GRT_SWAP_ID,
  theta: THETA_SWAP_ID,
  flow: FLOW_SWAP_ID,
  eos: EOS_SWAP_ID,
  egld: EGLD_SWAP_ID,
  qnt: QNT_SWAP_ID,
  stx: STX_SWAP_ID,
  xdc: XDC_SWAP_ID,
  nexo: NEXO_SWAP_ID,
  bsv: BSV_SWAP_ID,
  imx: IMX_SWAP_ID,
  rune: RUNE_SWAP_ID,
  kcs: KCS_SWAP_ID,
  flr: FLR_SWAP_ID,
  mkr: MKR_SWAP_ID,
  crv: CRV_SWAP_ID,
  comp: COMP_SWAP_ID,
  snx: SNX_SWAP_ID,
  ldo: LDO_SWAP_ID,
  axs: AXS_SWAP_ID,
  gala: GALA_SWAP_ID,
  chz: CHZ_SWAP_ID,
  iota: IOTA_SWAP_ID,
  rose: ROSE_SWAP_ID,
  kava: KAVA_SWAP_ID,
  mina: MINA_SWAP_ID,
  dash: DASH_SWAP_ID,
  neo: NEO_SWAP_ID,
  sfp: SFP_SWAP_ID,
  twt: TWT_SWAP_ID,
  zro: ZRO_SWAP_ID,
  strk: STRK_SWAP_ID,
  aero: AERO_SWAP_ID,
  virtual: VIRTUAL_SWAP_ID,
  beam: BEAM_SWAP_ID,
  akt: AKT_SWAP_ID,
  not: NOT_SWAP_ID,
  blur: BLUR_SWAP_ID,
  celo: CELO_SWAP_ID,
  ordi: ORDI_SWAP_ID,
  brett: BRETT_SWAP_ID,
  babydoge: BABYDOGE_SWAP_ID,
  wbt: WBT_SWAP_ID,
  rain: RAIN_SWAP_ID,
  cc: CC_SWAP_ID,
  htx: HTX_SWAP_ID,
  m: M_SWAP_ID,
  sky: SKY_SWAP_ID,
  morpho: MORPHO_SWAP_ID,
  wld: WLD_SWAP_ID,
  jst: JST_SWAP_ID,
  stable: STABLE_SWAP_ID,
  beat: BEAT_SWAP_ID,
  bdx: BDX_SWAP_ID,
  vvv: VVV_SWAP_ID,
  lit: LIT_SWAP_ID,
  pengu: PENGU_SWAP_ID,
  trump: TRUMP_SWAP_ID,
  ethfi: ETHFI_SWAP_ID,
  sun: SUN_SWAP_ID,
  night: NIGHT_SWAP_ID,
  tia: TIA_SWAP_ID,
  spx: SPX_SWAP_ID,
  lunc: LUNC_SWAP_ID,
  gno: GNO_SWAP_ID,
  robo: ROBO_SWAP_ID,
} as const;

export type LedgerMajorId = keyof typeof LEDGER_MAJOR_SWAP_IDS;

export const LEDGER_MAJOR_IDS = Object.keys(LEDGER_MAJOR_SWAP_IDS) as LedgerMajorId[];

export function isLedgerMajorId(id: string): id is LedgerMajorId {
  return Object.prototype.hasOwnProperty.call(LEDGER_MAJOR_SWAP_IDS, id);
}

export type LedgerAssetCode =
  | "OUSD"
  | "BTC"
  | "ETH"
  | "SOL"
  | "PI"
  | "USDC"
  | "USDT"
  | "PYUSD"
  | "USDG"
  | "USD1"
  | "CASH"
  | "EURC"
  | "HYPE"
  | "ZEC"
  | "TSLAX"
  | "NFLXX"
  | "GOOGLX"
  | "BNB"
  | "UNI"
  | "OKB"
  | "GT"
  | "BGB"
  | "CAKE"
  | "JUP"
  | "RON"
  | "XRP"
  | "TRX"
  | "DOGE"
  | "ADA"
  | "LINK"
  | "XLM"
  | "BCH"
  | "GRAM"
  | "AVAX"
  | "SUI"
  | "XAUT"
  | "ONDO"
  | "NEAR"
  | "USDY"
  | "PAXG"
  | "WLFI"
  | "ASTER"
  | "RLUSD"
  | "AAVE"
  | "DOT"
  | "PUMP"
  | "WBTC"
  | "LEO"
  | "SHIB"
  | "LTC"
  | "HBAR"
  | "PEPE"
  | "XMR"
  | "APT"
  | "TAO"
  | "ICP"
  | "ETC"
  | "CRO"
  | "MNT"
  | "POL"
  | "VET"
  | "ALGO"
  | "FIL"
  | "RENDER"
  | "ATOM"
  | "ARB"
  | "OP"
  | "INJ"
  | "SEI"
  | "FET"
  | "KAS"
  | "BONK"
  | "WIF"
  | "ENA"
  | "PYTH"
  | "PENDLE"
  | "SAND"
  | "MANA"
  | "GRT"
  | "THETA"
  | "FLOW"
  | "EOS"
  | "EGLD"
  | "QNT"
  | "STX"
  | "XDC"
  | "NEXO"
  | "BSV"
  | "IMX"
  | "RUNE"
  | "KCS"
  | "FLR"
  | "MKR"
  | "CRV"
  | "COMP"
  | "SNX"
  | "LDO"
  | "AXS"
  | "GALA"
  | "CHZ"
  | "IOTA"
  | "ROSE"
  | "KAVA"
  | "MINA"
  | "DASH"
  | "NEO"
  | "SFP"
  | "TWT"
  | "ZRO"
  | "STRK"
  | "AERO"
  | "VIRTUAL"
  | "BEAM"
  | "AKT"
  | "NOT"
  | "BLUR"
  | "CELO"
  | "ORDI"
  | "BRETT"
  | "BABYDOGE"
  | "WBT"
  | "RAIN"
  | "CC"
  | "HTX"
  | "M"
  | "SKY"
  | "MORPHO"
  | "WLD"
  | "JST"
  | "STABLE"
  | "BEAT"
  | "BDX"
  | "VVV"
  | "LIT"
  | "PENGU"
  | "TRUMP"
  | "ETHFI"
  | "SUN"
  | "NIGHT"
  | "TIA"
  | "SPX"
  | "LUNC"
  | "GNO"
  | "ROBO";

export const LEDGER_MAJOR_ASSET_CODES = [
  "BTC",
  "ETH",
  "SOL",
  "PI",
  "USDC",
  "USDT",
  "PYUSD",
  "USDG",
  "USD1",
  "CASH",
  "EURC",
  "HYPE",
  "ZEC",
  "TSLAX",
  "NFLXX",
  "GOOGLX",
  "BNB",
  "UNI",
  "OKB",
  "GT",
  "BGB",
  "CAKE",
  "JUP",
  "RON",
  "XRP",
  "TRX",
  "DOGE",
  "ADA",
  "LINK",
  "XLM",
  "BCH",
  "GRAM",
  "AVAX",
  "SUI",
  "XAUT",
  "ONDO",
  "NEAR",
  "USDY",
  "PAXG",
  "WLFI",
  "ASTER",
  "RLUSD",
  "AAVE",
  "DOT",
  "PUMP",
  "WBTC",
  "LEO",
  "SHIB",
  "LTC",
  "HBAR",
  "PEPE",
  "XMR",
  "APT",
  "TAO",
  "ICP",
  "ETC",
  "CRO",
  "MNT",
  "POL",
  "VET",
  "ALGO",
  "FIL",
  "RENDER",
  "ATOM",
  "ARB",
  "OP",
  "INJ",
  "SEI",
  "FET",
  "KAS",
  "BONK",
  "WIF",
  "ENA",
  "PYTH",
  "PENDLE",
  "SAND",
  "MANA",
  "GRT",
  "THETA",
  "FLOW",
  "EOS",
  "EGLD",
  "QNT",
  "STX",
  "XDC",
  "NEXO",
  "BSV",
  "IMX",
  "RUNE",
  "KCS",
  "FLR",
  "MKR",
  "CRV",
  "COMP",
  "SNX",
  "LDO",
  "AXS",
  "GALA",
  "CHZ",
  "IOTA",
  "ROSE",
  "KAVA",
  "MINA",
  "DASH",
  "NEO",
  "SFP",
  "TWT",
  "ZRO",
  "STRK",
  "AERO",
  "VIRTUAL",
  "BEAM",
  "AKT",
  "NOT",
  "BLUR",
  "CELO",
  "ORDI",
  "BRETT",
  "BABYDOGE",
  "WBT",
  "RAIN",
  "CC",
  "HTX",
  "M",
  "SKY",
  "MORPHO",
  "WLD",
  "JST",
  "STABLE",
  "BEAT",
  "BDX",
  "VVV",
  "LIT",
  "PENGU",
  "TRUMP",
  "ETHFI",
  "SUN",
  "NIGHT",
  "TIA",
  "SPX",
  "LUNC",
  "GNO",
  "ROBO",
] as const satisfies ReadonlyArray<Exclude<LedgerAssetCode, "OUSD">>;

export const LEDGER_ASSET_CODES = [
  "OUSD",
  ...LEDGER_MAJOR_ASSET_CODES,
] as const satisfies ReadonlyArray<LedgerAssetCode>;

export const LEDGER_BALANCE_COLUMN: Record<LedgerMajorId, string> = {
  btc: "btc_balance",
  eth: "eth_balance",
  sol: "sol_balance",
  pi: "pi_balance",
  usdc: "usdc_balance",
  usdt: "usdt_balance",
  pyusd: "pyusd_balance",
  usdg: "usdg_balance",
  usd1: "usd1_balance",
  cash: "cash_balance",
  eurc: "eurc_balance",
  hype: "hype_balance",
  zec: "zec_balance",
  tslax: "tslax_balance",
  nflxx: "nflxx_balance",
  googlx: "googlx_balance",
  bnb: "bnb_balance",
  uni: "uni_balance",
  okb: "okb_balance",
  gt: "gt_balance",
  bgb: "bgb_balance",
  cake: "cake_balance",
  jup: "jup_balance",
  ron: "ron_balance",
  xrp: "xrp_balance",
  trx: "trx_balance",
  doge: "doge_balance",
  ada: "ada_balance",
  link: "link_balance",
  xlm: "xlm_balance",
  bch: "bch_balance",
  gram: "gram_balance",
  avax: "avax_balance",
  sui: "sui_balance",
  xaut: "xaut_balance",
  ondo: "ondo_balance",
  near: "near_balance",
  usdy: "usdy_balance",
  paxg: "paxg_balance",
  wlfi: "wlfi_balance",
  aster: "aster_balance",
  rlusd: "rlusd_balance",
  aave: "aave_balance",
  dot: "dot_balance",
  pump: "pump_balance",
  wbtc: "wbtc_balance",
  leo: "leo_balance",
  shib: "shib_balance",
  ltc: "ltc_balance",
  hbar: "hbar_balance",
  pepe: "pepe_balance",
  xmr: "xmr_balance",
  apt: "apt_balance",
  tao: "tao_balance",
  icp: "icp_balance",
  etc: "etc_balance",
  cro: "cro_balance",
  mnt: "mnt_balance",
  pol: "pol_balance",
  vet: "vet_balance",
  algo: "algo_balance",
  fil: "fil_balance",
  render: "render_balance",
  atom: "atom_balance",
  arb: "arb_balance",
  op: "op_balance",
  inj: "inj_balance",
  sei: "sei_balance",
  fet: "fet_balance",
  kas: "kas_balance",
  bonk: "bonk_balance",
  wif: "wif_balance",
  ena: "ena_balance",
  pyth: "pyth_balance",
  pendle: "pendle_balance",
  sand: "sand_balance",
  mana: "mana_balance",
  grt: "grt_balance",
  theta: "theta_balance",
  flow: "flow_balance",
  eos: "eos_balance",
  egld: "egld_balance",
  qnt: "qnt_balance",
  stx: "stx_balance",
  xdc: "xdc_balance",
  nexo: "nexo_balance",
  bsv: "bsv_balance",
  imx: "imx_balance",
  rune: "rune_balance",
  kcs: "kcs_balance",
  flr: "flr_balance",
  mkr: "mkr_balance",
  crv: "crv_balance",
  comp: "comp_balance",
  snx: "snx_balance",
  ldo: "ldo_balance",
  axs: "axs_balance",
  gala: "gala_balance",
  chz: "chz_balance",
  iota: "iota_balance",
  rose: "rose_balance",
  kava: "kava_balance",
  mina: "mina_balance",
  dash: "dash_balance",
  neo: "neo_balance",
  sfp: "sfp_balance",
  twt: "twt_balance",
  zro: "zro_balance",
  strk: "strk_balance",
  aero: "aero_balance",
  virtual: "virtual_balance",
  beam: "beam_balance",
  akt: "akt_balance",
  not: "not_balance",
  blur: "blur_balance",
  celo: "celo_balance",
  ordi: "ordi_balance",
  brett: "brett_balance",
  babydoge: "babydoge_balance",
  wbt: "wbt_balance",
  rain: "rain_balance",
  cc: "cc_balance",
  htx: "htx_balance",
  m: "m_balance",
  sky: "sky_balance",
  morpho: "morpho_balance",
  wld: "wld_balance",
  jst: "jst_balance",
  stable: "stable_balance",
  beat: "beat_balance",
  bdx: "bdx_balance",
  vvv: "vvv_balance",
  lit: "lit_balance",
  pengu: "pengu_balance",
  trump: "trump_balance",
  ethfi: "ethfi_balance",
  sun: "sun_balance",
  night: "night_balance",
  tia: "tia_balance",
  spx: "spx_balance",
  lunc: "lunc_balance",
  gno: "gno_balance",
  robo: "robo_balance",
};

const SWAP_ID_TO_MAJOR: Record<string, LedgerMajorId> = {
  [BTC_SWAP_ID]: "btc",
  btc: "btc",
  [ETH_SWAP_ID]: "eth",
  eth: "eth",
  [SOL_SWAP_ID]: "sol",
  sol: "sol",
  [PI_SWAP_ID]: "pi",
  pi: "pi",
  [USDC_SWAP_ID]: "usdc",
  usdc: "usdc",
  [USDT_SWAP_ID]: "usdt",
  usdt: "usdt",
  [PYUSD_SWAP_ID]: "pyusd",
  pyusd: "pyusd",
  [USDG_SWAP_ID]: "usdg",
  usdg: "usdg",
  [USD1_SWAP_ID]: "usd1",
  usd1: "usd1",
  [CASH_SWAP_ID]: "cash",
  cash: "cash",
  [EURC_SWAP_ID]: "eurc",
  eurc: "eurc",
  [HYPE_SWAP_ID]: "hype",
  hype: "hype",
  [ZEC_SWAP_ID]: "zec",
  zec: "zec",
  [TSLAX_SWAP_ID]: "tslax",
  tslax: "tslax",
  [NFLXX_SWAP_ID]: "nflxx",
  nflxx: "nflxx",
  [GOOGLX_SWAP_ID]: "googlx",
  googlx: "googlx",
  [BNB_SWAP_ID]: "bnb",
  bnb: "bnb",
  [UNI_SWAP_ID]: "uni",
  uni: "uni",
  [OKB_SWAP_ID]: "okb",
  okb: "okb",
  [GT_SWAP_ID]: "gt",
  gt: "gt",
  [BGB_SWAP_ID]: "bgb",
  bgb: "bgb",
  [CAKE_SWAP_ID]: "cake",
  cake: "cake",
  [JUP_SWAP_ID]: "jup",
  jup: "jup",
  [RON_SWAP_ID]: "ron",
  ron: "ron",
  [XRP_SWAP_ID]: "xrp",
  xrp: "xrp",
  [TRX_SWAP_ID]: "trx",
  trx: "trx",
  [DOGE_SWAP_ID]: "doge",
  doge: "doge",
  [ADA_SWAP_ID]: "ada",
  ada: "ada",
  [LINK_SWAP_ID]: "link",
  link: "link",
  [XLM_SWAP_ID]: "xlm",
  xlm: "xlm",
  [BCH_SWAP_ID]: "bch",
  bch: "bch",
  [GRAM_SWAP_ID]: "gram",
  gram: "gram",
  [AVAX_SWAP_ID]: "avax",
  avax: "avax",
  [SUI_SWAP_ID]: "sui",
  sui: "sui",
  [XAUT_SWAP_ID]: "xaut",
  xaut: "xaut",
  [ONDO_SWAP_ID]: "ondo",
  ondo: "ondo",
  [NEAR_SWAP_ID]: "near",
  near: "near",
  [USDY_SWAP_ID]: "usdy",
  usdy: "usdy",
  [PAXG_SWAP_ID]: "paxg",
  paxg: "paxg",
  [WLFI_SWAP_ID]: "wlfi",
  wlfi: "wlfi",
  [ASTER_SWAP_ID]: "aster",
  aster: "aster",
  [RLUSD_SWAP_ID]: "rlusd",
  rlusd: "rlusd",
  [AAVE_SWAP_ID]: "aave",
  aave: "aave",
  [DOT_SWAP_ID]: "dot",
  dot: "dot",
  [PUMP_SWAP_ID]: "pump",
  pump: "pump",
  [WBTC_SWAP_ID]: "wbtc",
  wbtc: "wbtc",
  [LEO_SWAP_ID]: "leo",
  leo: "leo",
  [SHIB_SWAP_ID]: "shib",
  shib: "shib",
  [LTC_SWAP_ID]: "ltc",
  ltc: "ltc",
  [HBAR_SWAP_ID]: "hbar",
  hbar: "hbar",
  [PEPE_SWAP_ID]: "pepe",
  pepe: "pepe",
  [XMR_SWAP_ID]: "xmr",
  xmr: "xmr",
  [APT_SWAP_ID]: "apt",
  apt: "apt",
  [TAO_SWAP_ID]: "tao",
  tao: "tao",
  [ICP_SWAP_ID]: "icp",
  icp: "icp",
  [ETC_SWAP_ID]: "etc",
  etc: "etc",
  [CRO_SWAP_ID]: "cro",
  cro: "cro",
  [MNT_SWAP_ID]: "mnt",
  mnt: "mnt",
  [POL_SWAP_ID]: "pol",
  pol: "pol",
  [VET_SWAP_ID]: "vet",
  vet: "vet",
  [ALGO_SWAP_ID]: "algo",
  algo: "algo",
  [FIL_SWAP_ID]: "fil",
  fil: "fil",
  [RENDER_SWAP_ID]: "render",
  render: "render",
  [ATOM_SWAP_ID]: "atom",
  atom: "atom",
  [ARB_SWAP_ID]: "arb",
  arb: "arb",
  [OP_SWAP_ID]: "op",
  op: "op",
  [INJ_SWAP_ID]: "inj",
  inj: "inj",
  [SEI_SWAP_ID]: "sei",
  sei: "sei",
  [FET_SWAP_ID]: "fet",
  fet: "fet",
  [KAS_SWAP_ID]: "kas",
  kas: "kas",
  [BONK_SWAP_ID]: "bonk",
  bonk: "bonk",
  [WIF_SWAP_ID]: "wif",
  wif: "wif",
  [ENA_SWAP_ID]: "ena",
  ena: "ena",
  [PYTH_SWAP_ID]: "pyth",
  pyth: "pyth",
  [PENDLE_SWAP_ID]: "pendle",
  pendle: "pendle",
  [SAND_SWAP_ID]: "sand",
  sand: "sand",
  [MANA_SWAP_ID]: "mana",
  mana: "mana",
  [GRT_SWAP_ID]: "grt",
  grt: "grt",
  [THETA_SWAP_ID]: "theta",
  theta: "theta",
  [FLOW_SWAP_ID]: "flow",
  flow: "flow",
  [EOS_SWAP_ID]: "eos",
  eos: "eos",
  [EGLD_SWAP_ID]: "egld",
  egld: "egld",
  [QNT_SWAP_ID]: "qnt",
  qnt: "qnt",
  [STX_SWAP_ID]: "stx",
  stx: "stx",
  [XDC_SWAP_ID]: "xdc",
  xdc: "xdc",
  [NEXO_SWAP_ID]: "nexo",
  nexo: "nexo",
  [BSV_SWAP_ID]: "bsv",
  bsv: "bsv",
  [IMX_SWAP_ID]: "imx",
  imx: "imx",
  [RUNE_SWAP_ID]: "rune",
  rune: "rune",
  [KCS_SWAP_ID]: "kcs",
  kcs: "kcs",
  [FLR_SWAP_ID]: "flr",
  flr: "flr",
  [MKR_SWAP_ID]: "mkr",
  mkr: "mkr",
  [CRV_SWAP_ID]: "crv",
  crv: "crv",
  [COMP_SWAP_ID]: "comp",
  comp: "comp",
  [SNX_SWAP_ID]: "snx",
  snx: "snx",
  [LDO_SWAP_ID]: "ldo",
  ldo: "ldo",
  [AXS_SWAP_ID]: "axs",
  axs: "axs",
  [GALA_SWAP_ID]: "gala",
  gala: "gala",
  [CHZ_SWAP_ID]: "chz",
  chz: "chz",
  [IOTA_SWAP_ID]: "iota",
  iota: "iota",
  [ROSE_SWAP_ID]: "rose",
  rose: "rose",
  [KAVA_SWAP_ID]: "kava",
  kava: "kava",
  [MINA_SWAP_ID]: "mina",
  mina: "mina",
  [DASH_SWAP_ID]: "dash",
  dash: "dash",
  [NEO_SWAP_ID]: "neo",
  neo: "neo",
  [SFP_SWAP_ID]: "sfp",
  sfp: "sfp",
  [TWT_SWAP_ID]: "twt",
  twt: "twt",
  [ZRO_SWAP_ID]: "zro",
  zro: "zro",
  [STRK_SWAP_ID]: "strk",
  strk: "strk",
  [AERO_SWAP_ID]: "aero",
  aero: "aero",
  [VIRTUAL_SWAP_ID]: "virtual",
  virtual: "virtual",
  [BEAM_SWAP_ID]: "beam",
  beam: "beam",
  [AKT_SWAP_ID]: "akt",
  akt: "akt",
  [NOT_SWAP_ID]: "not",
  not: "not",
  [BLUR_SWAP_ID]: "blur",
  blur: "blur",
  [CELO_SWAP_ID]: "celo",
  celo: "celo",
  [ORDI_SWAP_ID]: "ordi",
  ordi: "ordi",
  [BRETT_SWAP_ID]: "brett",
  brett: "brett",
  [BABYDOGE_SWAP_ID]: "babydoge",
  babydoge: "babydoge",
  [WBT_SWAP_ID]: "wbt",
  wbt: "wbt",
  [RAIN_SWAP_ID]: "rain",
  rain: "rain",
  [CC_SWAP_ID]: "cc",
  cc: "cc",
  [HTX_SWAP_ID]: "htx",
  htx: "htx",
  [M_SWAP_ID]: "m",
  m: "m",
  [SKY_SWAP_ID]: "sky",
  sky: "sky",
  [MORPHO_SWAP_ID]: "morpho",
  morpho: "morpho",
  [WLD_SWAP_ID]: "wld",
  wld: "wld",
  [JST_SWAP_ID]: "jst",
  jst: "jst",
  [STABLE_SWAP_ID]: "stable",
  stable: "stable",
  [BEAT_SWAP_ID]: "beat",
  beat: "beat",
  [BDX_SWAP_ID]: "bdx",
  bdx: "bdx",
  [VVV_SWAP_ID]: "vvv",
  vvv: "vvv",
  [LIT_SWAP_ID]: "lit",
  lit: "lit",
  [PENGU_SWAP_ID]: "pengu",
  pengu: "pengu",
  [TRUMP_SWAP_ID]: "trump",
  trump: "trump",
  [ETHFI_SWAP_ID]: "ethfi",
  ethfi: "ethfi",
  [SUN_SWAP_ID]: "sun",
  sun: "sun",
  [NIGHT_SWAP_ID]: "night",
  night: "night",
  [TIA_SWAP_ID]: "tia",
  tia: "tia",
  [SPX_SWAP_ID]: "spx",
  spx: "spx",
  [LUNC_SWAP_ID]: "lunc",
  lunc: "lunc",
  [GNO_SWAP_ID]: "gno",
  gno: "gno",
  [ROBO_SWAP_ID]: "robo",
  robo: "robo",
};

export function isLedgerMajorSwapId(id: string): boolean {
  return (
    id in SWAP_ID_TO_MAJOR ||
    (Object.values(LEDGER_MAJOR_SWAP_IDS) as string[]).includes(id)
  );
}

export function majorIdFromSwapId(id: string): LedgerMajorId | null {
  return SWAP_ID_TO_MAJOR[id] ?? null;
}

export function isLedgerSwapId(id: string): boolean {
  return id === OUSD_SWAP_ID || isLedgerMajorSwapId(id);
}

export function ledgerAssetFromMajor(id: LedgerMajorId): Exclude<LedgerAssetCode, "OUSD"> {
  return MAJOR_TOKENS[id].symbol.toUpperCase() as Exclude<LedgerAssetCode, "OUSD">;
}

export function majorIdFromAssetCode(code: string): LedgerMajorId | null {
  const c = code.toUpperCase();
  for (const id of LEDGER_MAJOR_IDS) {
    if (MAJOR_TOKENS[id].symbol.toUpperCase() === c) return id;
  }
  return null;
}

const NETWORK_LABEL_MAP: Record<string, SwapNetworkId> = {
  Bitcoin: "bitcoin",
  "Bitcoin Cash": "bitcoin-cash",
  Ethereum: "ethereum",
  Solana: "solana",
  "BNB Smart Chain": "bnb",
  BNB: "bnb",
  Ronin: "ronin",
  "XRP Ledger": "xrp",
  XRP: "xrp",
  TRON: "tron",
  Tron: "tron",
  Dogecoin: "dogecoin",
  Cardano: "cardano",
  Stellar: "stellar",
  TON: "ton",
  Avalanche: "avalanche",
  Sui: "sui",
  NEAR: "near",
  Polkadot: "polkadot",
  "Pi Network": "pi",
  Pi: "pi",
};

export function networkForMajor(id: LedgerMajorId): SwapNetworkId {
  // Prefer explicit native/chain majors
  if (id === "btc") return "bitcoin";
  if (id === "bch") return "bitcoin-cash";
  if (id === "dot") return "polkadot";
  if (id === "bnb" || id === "cake" || id === "aster") return "bnb";
  if (id === "ron") return "ronin";
  if (id === "xrp" || id === "rlusd") return "xrp";
  if (id === "trx") return "tron";
  if (id === "doge") return "dogecoin";
  if (id === "ada") return "cardano";
  if (id === "xlm") return "stellar";
  if (id === "gram") return "ton";
  if (id === "avax") return "avalanche";
  if (id === "sui") return "sui";
  if (id === "near") return "near";
  if (id === "pi") return "pi";
  if (
    id === "sol" ||
    id === "usdc" ||
    id === "usdt" ||
    id === "pyusd" ||
    id === "usdg" ||
    id === "usd1" ||
    id === "cash" ||
    id === "hype" ||
    id === "zec" ||
    id === "tslax" ||
    id === "nflxx" ||
    id === "googlx" ||
    id === "jup" ||
    id === "pump" ||
    id === "bonk" ||
    id === "wif" ||
    id === "pyth" ||
    id === "pengu" ||
    id === "trump"
  ) {
    return "solana";
  }
  const label = MAJOR_TOKENS[id]?.network;
  if (label && NETWORK_LABEL_MAP[label]) return NETWORK_LABEL_MAP[label];
  // Default ERC-20-style listings to Ethereum swap network
  return "ethereum";
}

/** Primary native asset for a network (one per chain). */
export function majorForNetwork(network: SwapNetworkId): LedgerMajorId | null {
  if (network === "bitcoin") return "btc";
  if (network === "bitcoin-cash") return "bch";
  if (network === "ethereum") return "eth";
  if (network === "solana") return "sol";
  if (network === "bnb") return "bnb";
  if (network === "ronin") return "ron";
  if (network === "xrp") return "xrp";
  if (network === "tron") return "trx";
  if (network === "dogecoin") return "doge";
  if (network === "cardano") return "ada";
  if (network === "stellar") return "xlm";
  if (network === "ton") return "gram";
  if (network === "avalanche") return "avax";
  if (network === "sui") return "sui";
  if (network === "near") return "near";
  if (network === "polkadot") return "dot";
  if (network === "pi") return "pi";
  return null;
}

/** All ledger majors that belong on a swap network. */
export function majorsForNetwork(network: SwapNetworkId): LedgerMajorId[] {
  return LEDGER_MAJOR_IDS.filter((id) => networkForMajor(id) === network);
}

const FALLBACK_USD: Record<LedgerMajorId, number> = {
  btc: 65000,
  eth: 1920,
  sol: 74,
  pi: 0.079,
  usdc: 1,
  usdt: 1,
  pyusd: 1,
  usdg: 1,
  usd1: 1,
  cash: 1,
  eurc: 1.08,
  hype: 55,
  zec: 450,
  tslax: 308,
  nflxx: 70,
  googlx: 200,
  bnb: 584,
  uni: 4.21,
  okb: 87.36,
  gt: 6.46,
  bgb: 1.63,
  cake: 1.42,
  jup: 0.197,
  ron: 0.0487,
  xrp: 1.083,
  trx: 0.328,
  doge: 0.0703,
  ada: 0.187,
  link: 8.38,
  xlm: 0.177,
  bch: 212.24,
  gram: 1.4,
  avax: 6.62,
  sui: 0.691,
  xaut: 4045,
  ondo: 0.393,
  near: 1.72,
  usdy: 1.14,
  paxg: 4056,
  wlfi: 0.0554,
  aster: 0.604,
  rlusd: 1,
  aave: 92.46,
  dot: 0.792,
  pump: 0.002184,
  wbtc: 108000,
  leo: 9.2,
  shib: 0.0000125,
  ltc: 85,
  hbar: 0.165,
  pepe: 0.0000072,
  xmr: 265,
  apt: 3.9,
  tao: 290,
  icp: 4.2,
  etc: 16.5,
  cro: 0.12,
  mnt: 0.72,
  pol: 0.195,
  vet: 0.022,
  algo: 0.18,
  fil: 2.3,
  render: 3.1,
  atom: 4.2,
  arb: 0.32,
  op: 0.55,
  inj: 9.5,
  sei: 0.22,
  fet: 0.55,
  kas: 0.075,
  bonk: 0.000018,
  wif: 0.55,
  ena: 0.32,
  pyth: 0.11,
  pendle: 3.2,
  sand: 0.22,
  mana: 0.25,
  grt: 0.085,
  theta: 0.72,
  flow: 0.35,
  eos: 0.45,
  egld: 12.5,
  qnt: 85,
  stx: 0.55,
  xdc: 0.055,
  nexo: 1.05,
  bsv: 45,
  imx: 0.45,
  rune: 1.15,
  kcs: 10.5,
  flr: 0.018,
  mkr: 1450,
  crv: 0.55,
  comp: 42,
  snx: 0.65,
  ldo: 0.85,
  axs: 2.2,
  gala: 0.014,
  chz: 0.035,
  iota: 0.16,
  rose: 0.025,
  kava: 0.35,
  mina: 0.15,
  dash: 22,
  neo: 5.5,
  sfp: 0.45,
  twt: 0.95,
  zro: 1.8,
  strk: 0.12,
  aero: 0.75,
  virtual: 1.2,
  beam: 0.0065,
  akt: 1.05,
  not: 0.0015,
  blur: 0.12,
  celo: 0.28,
  ordi: 8.5,
  brett: 0.035,
  babydoge: 1.2e-9,
  wbt: 27,
  rain: 0.0075,
  cc: 0.11,
  htx: 0.0000019,
  m: 0.55,
  sky: 0.055,
  morpho: 1.45,
  wld: 0.323,
  jst: 0.104,
  stable: 0.0325,
  beat: 2.55,
  bdx: 0.083,
  vvv: 11.55,
  lit: 2.14,
  pengu: 0.00608,
  trump: 1.47,
  ethfi: 0.364,
  sun: 0.0179,
  night: 0.0000035,
  tia: 1.55,
  spx: 0.85,
  lunc: 0.000055,
  gno: 125,
  robo: 0.0128,
};

/** Live PI/USD used by display currency (π) — refreshed by fetchMajorUsdPrices. */
let cachedPiUsd = FALLBACK_USD.pi;

export function getCachedPiUsdPrice(): number {
  return cachedPiUsd > 0 ? cachedPiUsd : FALLBACK_USD.pi;
}

export function setCachedPiUsdPrice(price: number): void {
  if (price > 0) cachedPiUsd = price;
}

const CG_PRICE_CHUNK = 80;

export async function fetchMajorUsdPrices(
  ids: LedgerMajorId[] = [...LEDGER_MAJOR_IDS],
): Promise<Record<LedgerMajorId, number>> {
  const out = { ...FALLBACK_USD } as Record<LedgerMajorId, number>;
  try {
    const cgIds = ids
      .map((id) => MAJOR_TOKENS[id].coingeckoId)
      .filter((id) => id !== "phantom-cash");
    for (let i = 0; i < cgIds.length; i += CG_PRICE_CHUNK) {
      const chunk = cgIds.slice(i, i + CG_PRICE_CHUNK);
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${chunk.join(",")}&vs_currencies=usd`,
        { headers: { accept: "application/json" } },
      );
      if (!res.ok) continue;
      const j = (await res.json()) as Record<string, { usd?: number }>;
      for (const id of ids) {
        const p = Number(j[MAJOR_TOKENS[id].coingeckoId]?.usd);
        if (p > 0) out[id] = p;
      }
    }
  } catch {
    /* keep fallbacks */
  }

  // Browser: enrich with Trust Wallet index prices via same-origin proxy
  // (HMAC secrets never leave the server).
  if (typeof window !== "undefined") {
    try {
      const { trustWalletAssetIdsForMajors } = await import(
        "@/lib/trustwallet-assets"
      );
      const mapped = trustWalletAssetIdsForMajors(ids);
      for (let i = 0; i < mapped.length; i += 50) {
        const chunk = mapped.slice(i, i + 50);
        const res = await fetch("/api/public/trustwallet-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currency: "USD",
            assets: chunk.map((c) => c.assetId),
          }),
        });
        if (!res.ok) break;
        const j = (await res.json()) as {
          tickers?: Array<{ id: string; price?: number }>;
        };
        const byId = new Map(
          (j.tickers ?? []).map((t) => [t.id, Number(t.price)] as const),
        );
        for (const { assetId, majorId } of chunk) {
          const p = byId.get(assetId);
          if (p && p > 0) out[majorId] = p;
        }
      }
    } catch {
      /* keep CoinGecko / fallbacks */
    }
  }

  if (out.pi > 0) cachedPiUsd = out.pi;
  return out;
}

/** PI amount required to cover an OUSD/$ amount (1 OUSD = $1). */
export function piAmountForOusd(ousdAmount: number, piUsdPrice = getCachedPiUsdPrice()): number {
  const price = piUsdPrice > 0 ? piUsdPrice : FALLBACK_USD.pi;
  return Math.round((ousdAmount / price) * 1e6) / 1e6;
}

/** OUSD/$ credited for a paid PI amount at live price. */
export function ousdFromPiAmount(piAmount: number, piUsdPrice = getCachedPiUsdPrice()): number {
  const price = piUsdPrice > 0 ? piUsdPrice : FALLBACK_USD.pi;
  return Math.round(piAmount * price * 1e8) / 1e8;
}

export function walletMajorSelect(extraPrefix = "id, user_id, address, ousd_balance"): string {
  const cols = LEDGER_MAJOR_IDS.map((id) => LEDGER_BALANCE_COLUMN[id]).join(", ");
  return `${extraPrefix}, ${cols}`;
}

export function readMajorBalance(
  wallet: Record<string, unknown> | null | undefined,
  major: LedgerMajorId,
): number {
  if (!wallet) return 0;
  const col = LEDGER_BALANCE_COLUMN[major];
  return Number(wallet[col] ?? 0);
}

export function majorBalancePatch(
  major: LedgerMajorId,
  next: number,
): Record<string, number> {
  return { [LEDGER_BALANCE_COLUMN[major]]: next };
}

export function isLedgerAssetCode(code: string): code is LedgerAssetCode {
  return (LEDGER_ASSET_CODES as readonly string[]).includes(code.toUpperCase());
}

export { isMajorTokenId, FALLBACK_USD as FALLBACK_MAJOR_USD_PRICES };

/** Runtime check: every MajorTokenId has a ledger column. */
export function assertLedgerCoversCatalog(): void {
  for (const id of Object.keys(MAJOR_TOKENS) as MajorTokenId[]) {
    if (!isLedgerMajorId(id)) {
      throw new Error(`Missing ledger major: ${id}`);
    }
  }
}
