import { OUSD_LOGO_URL } from "@/lib/token-logos";

/** Brand SVG from Simple Icons CDN (colored). */
function si(slug: string) {
  return `https://cdn.simpleicons.org/${slug}`;
}

/** Philippine brand SVG from PHLogos. */
function ph(slug: string) {
  return `https://phlogos.com/logos/${slug}.svg`;
}

/** Country flag SVG (FlagCDN) — preferred icon for country bank transfers. */
function flag(cc: string) {
  return `https://flagcdn.com/${cc.toLowerCase()}.svg`;
}

/** High-res site favicon (fallback when Simple Icons has no brand). */
function fav(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

/**
 * Ordered logo candidates per P2P payment method code.
 * Primary sources follow the approved Simple Icons / PHLogos set; favicons / local SVGs as fallback.
 */
export const P2P_PAYMENT_LOGO_CANDIDATES: Record<string, string[]> = {
  openpay: [OUSD_LOGO_URL, "/ousd-logo.svg", "https://openpaypro.space/logo.png"],
  bank_transfer: ["/p2p-pay/bank-transfer.svg", si("sepa"), fav("swift.com")],
  cash_in_person: ["/p2p-pay/cash.svg", si("contactlesspayment")],

  // —— Global ——
  paypal: [si("paypal"), fav("paypal.com")],
  wise: [si("wise"), fav("wise.com")],
  payoneer: [si("payoneer"), fav("payoneer.com")],
  skrill: [si("skrill"), fav("skrill.com")],
  neteller: [si("neteller"), fav("neteller.com"), fav("paysafe.com")],
  western_union: [si("westernunion"), fav("westernunion.com")],
  moneygram: [si("moneygram"), fav("moneygram.com")],
  remitly: [fav("remitly.com")],
  worldremit: [fav("worldremit.com")],
  swift: [si("swift"), fav("swift.com")],
  sepa: [si("sepa"), fav("sepaforecorporates.com")],

  // —— Americas ——
  zelle: [si("zelle"), fav("zellepay.com")],
  cash_app: [si("cashapp"), fav("cash.app")],
  venmo: [si("venmo"), fav("venmo.com")],
  chime: [si("chime"), fav("chime.com")],
  interac: [fav("interac.ca")],
  pix: [si("pix"), fav("bcb.gov.br")],
  picpay: [si("picpay"), fav("picpay.com")],
  mercado_pago: [si("mercadopago"), fav("mercadopago.com")],
  spei: [fav("banxico.org.mx"), "/p2p-pay/bank-transfer.svg"],
  oxxo: [fav("oxxo.com")],
  nequi: [fav("nequi.com.co")],
  daviplata: [fav("davivienda.com")],
  yape: [fav("yape.com.pe")],
  plin: [fav("plin.pe")],
  banco_inter: [fav("bancointer.com.br"), "/p2p-pay/bank-transfer.svg"],
  uala: [fav("uala.com.ar")],
  pago_movil: ["/p2p-pay/bank-transfer.svg", fav("banesco.com")],

  // —— Europe ——
  revolut: [si("revolut"), fav("revolut.com")],
  bizum: [fav("bizum.es")],
  blik: [fav("blik.com")],
  multibanco: [fav("multibanco.pt"), fav("sibs.pt")],
  mb_way: [fav("mbway.pt"), fav("sibs.pt")],
  swish: [fav("swish.nu")],
  vipps: [fav("vipps.no")],
  mobilepay: [fav("mobilepay.dk")],
  twint: [fav("twint.ch")],
  ideal: [si("ideal"), fav("ideal.nl")],
  bancontact: [fav("bancontact.com")],
  giropay: [fav("giropay.de")],
  sofort: [si("klarna"), fav("klarna.com")],
  paysafecard: [fav("paysafecard.com")],
  fps_uk: ["/p2p-pay/bank-transfer.svg", fav("pay.uk")],

  // —— Philippines rails ——
  bancnet: [fav("bancnetonline.com"), "/p2p-pay/bank-transfer.svg"],
  instapay: [fav("instapay.ph"), fav("bsp.gov.ph"), "/p2p-pay/bank-transfer.svg"],
  pesonet: [fav("pesonet.com.ph"), fav("bsp.gov.ph"), "/p2p-pay/bank-transfer.svg"],
  qr_ph: [fav("bsp.gov.ph"), "/p2p-pay/bank-transfer.svg"],

  // —— Philippines banks ——
  bdo: [ph("bdo"), fav("bdo.com.ph")],
  bpi: [ph("bpi"), fav("bpi.com.ph")],
  metrobank: [ph("metrobank"), fav("metrobank.com.ph")],
  unionbank: [ph("unionbank"), fav("unionbankph.com")],
  pnb: [ph("pnb"), fav("pnb.com.ph")],
  chinabank: [ph("chinabank"), fav("chinabank.ph")],
  security_bank: [ph("securitybank"), fav("securitybank.com")],
  landbank: [fav("landbank.com"), "/p2p-pay/bank-transfer.svg"],
  dbp: [fav("dbp.ph"), "/p2p-pay/bank-transfer.svg"],
  eastwest: [fav("eastwestbanker.com"), "/p2p-pay/bank-transfer.svg"],
  rcbc: [fav("rcbc.com"), "/p2p-pay/bank-transfer.svg"],
  psbank: [fav("psbank.com.ph"), "/p2p-pay/bank-transfer.svg"],
  aub: [fav("aub.com.ph"), "/p2p-pay/bank-transfer.svg"],
  bank_of_commerce: [fav("bankcom.com.ph"), "/p2p-pay/bank-transfer.svg"],
  pbcom: [fav("pbcom.com.ph"), "/p2p-pay/bank-transfer.svg"],
  maybank: [fav("maybank.com.ph"), fav("maybank2u.com.ph")],
  cimb: [fav("cimbbank.com.ph"), fav("cimb.com")],
  gotyme: [fav("gotyme.com.ph"), "/p2p-pay/bank-transfer.svg"],
  seabank: [fav("seabank.ph"), fav("shopee.ph")],
  ownbank: [fav("ownbank.com.ph"), "/p2p-pay/bank-transfer.svg"],
  tonik: [fav("tonikbank.com"), "/p2p-pay/bank-transfer.svg"],
  unobank: [fav("unobank.com.ph"), fav("unobank.ph")],
  uniondigital: [fav("unionbankph.com"), ph("unionbank")],
  mayabank: [si("maya"), fav("maya.ph")],

  // —— Philippines e-wallets ——
  gcash: [si("gcash"), fav("gcash.com"), fav("mynt.xyz")],
  maya: [si("maya"), fav("maya.ph"), fav("paymaya.com")],
  grabpay: [si("grab"), fav("grab.com")],
  coinsph: [fav("coins.ph"), "/p2p-pay/bank-transfer.svg"],
  paymaya_business: [si("maya"), fav("maya.ph"), fav("paymaya.com")],
  diskartech: [fav("diskartech.com"), fav("rcbc.com")],
  hellomoney: [fav("aub.com.ph"), fav("hellomoney.ph")],
  vipwallet: [fav("vip.ph"), "/p2p-pay/bank-transfer.svg"],
  traxionpay: [fav("traxionpay.com"), "/p2p-pay/bank-transfer.svg"],
  ecpay: [fav("ecpay.com.ph"), "/p2p-pay/bank-transfer.svg"],

  // —— Asia / SEA ——
  shopeepay: [si("shopee"), fav("shopee.com")],
  gopay: [si("gojek"), fav("gojek.com")],
  ovo: [si("ovo"), fav("ovo.id")],
  dana: [si("dana"), fav("dana.id")],
  linkaja: [fav("linkaja.id")],
  qris: [fav("qris.id"), "/p2p-pay/bank-transfer.svg"],
  promptpay: [fav("kasikornbank.com"), fav("scb.co.th")],
  true_money: [fav("truemoney.com")],
  momo: [fav("momo.vn")],
  zalopay: [fav("zalopay.vn")],
  viettel_money: [fav("viettelmoney.vn"), fav("viettel.com.vn")],
  touch_n_go: [si("touchngo"), fav("touchngo.com.my"), fav("tngdigital.com.my")],
  boost: [si("boost"), fav("myboost.com.my")],
  fpx: [fav("paynet.my"), fav("fpx.com.my")],
  paynow: [fav("abs.org.sg"), fav("dbs.com.sg")],
  paylah: [fav("dbs.com.sg")],

  // —— South / East Asia ——
  upi: [fav("npci.org.in"), fav("upi.com")],
  paytm: [si("paytm"), fav("paytm.com")],
  phonepe: [si("phonepe"), fav("phonepe.com")],
  google_pay_in: [si("googlepay"), fav("pay.google.com")],
  imps: [fav("npci.org.in"), "/p2p-pay/bank-transfer.svg"],
  neft: ["/p2p-pay/bank-transfer.svg", fav("rbi.org.in")],
  alipay: [si("alipay"), fav("alipay.com")],
  wechat_pay: [si("wechat"), fav("wechat.com")],
  fps_hk: [fav("hkicl.com.hk"), "/p2p-pay/bank-transfer.svg"],
  payme_hk: [fav("payme.hsbc.com.hk"), fav("hsbc.com.hk")],
  kakao_pay: [si("kakaotalk"), si("kakao"), fav("kakaopay.com")],
  toss: [fav("toss.im")],
  naver_pay: [si("naver"), fav("pay.naver.com")],
  paypay: [si("paypay"), fav("paypay.ne.jp")],
  line_pay: [si("line"), fav("line.me")],
  bank_transfer_jp: [flag("jp"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_kr: [flag("kr"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_cn: [flag("cn"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_tw: [flag("tw"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_hk: [flag("hk"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_sg: [flag("sg"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_my: [flag("my"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_id: [flag("id"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_th: [flag("th"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_vn: [flag("vn"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_ph: [flag("ph"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_in: [flag("in"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_bd: [flag("bd"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_pk: [flag("pk"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_ae: [flag("ae"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_sa: [flag("sa"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_eg: [flag("eg"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_tr: [flag("tr"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_ng: [flag("ng"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_za: [flag("za"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_ke: [flag("ke"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_au: [flag("au"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_nz: [flag("nz"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_us: [flag("us"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_ca: [flag("ca"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_mx: [flag("mx"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_br: [flag("br"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_ar: [flag("ar"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_co: [flag("co"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_pe: [flag("pe"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_gb: [flag("gb"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_fr: [flag("fr"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_de: [flag("de"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_es: [flag("es"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_it: [flag("it"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_nl: [flag("nl"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_be: [flag("be"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_ch: [flag("ch"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_se: [flag("se"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_no: [flag("no"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_dk: [flag("dk"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_pl: [flag("pl"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_pt: [flag("pt"), "/p2p-pay/bank-transfer.svg"],
  bank_transfer_ie: [flag("ie"), "/p2p-pay/bank-transfer.svg"],

  bkash: [si("bkash"), fav("bkash.com"), fav("bka.sh")],
  nagad: [fav("nagad.com.bd")],
  easypaisa: [si("easypaisa"), fav("easypaisa.com.pk")],
  jazzcash: [si("jazzcash"), fav("jazzcash.com.pk")],

  // —— Middle East ——
  stc_pay: [si("stc"), fav("stcpay.com.sa")],
  mada: [fav("mada.com.sa")],
  instapay_eg: [fav("instapay.eg"), fav("cbe.org.eg"), flag("eg")],
  vodafone_cash: [si("vodafone"), fav("vodafone.com.eg")],
  fawry: [si("fawry"), fav("fawry.com")],
  papara: [si("papara"), fav("papara.com")],

  // —— Africa ——
  mpesa: [si("mpesa"), fav("safaricom.co.ke"), fav("mpesa.com")],
  airtel_money: [si("airtel"), fav("airtel.in")],
  orange_money: [si("orange"), fav("orange.com")],
  mtn_momo: [si("mtn"), fav("mtn.com"), fav("mtn.co.za")],
  opay: [si("opay"), fav("opayweb.com"), fav("opay.com")],
  palmpay: [si("palmpay"), fav("palmpay.com")],
  chipper_cash: [si("chippercash"), fav("chippercash.com")],

  // —— Oceania ——
  payid: [fav("payid.com.au"), fav("auspaynet.com.au"), flag("au")],
  osko: [fav("osko.com.au"), fav("auspaynet.com.au"), flag("au")],
};

export function logoCandidatesForP2pPayment(code: string, primaryUrl?: string | null): string[] {
  const base = P2P_PAYMENT_LOGO_CANDIDATES[code] ?? ["/p2p-pay/bank-transfer.svg"];
  const primary = primaryUrl?.trim();
  if (!primary) return base;
  return [primary, ...base.filter((u) => u !== primary)];
}

export function logoUrlForP2pPayment(code: string, primaryUrl?: string | null): string {
  return logoCandidatesForP2pPayment(code, primaryUrl)[0]!;
}
