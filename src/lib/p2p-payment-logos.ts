import { OUSD_LOGO_URL } from "@/lib/token-logos";

/** Brand SVG from Simple Icons CDN (colored). */
function si(slug: string) {
  return `https://cdn.simpleicons.org/${slug}`;
}

/** High-res site favicon (fallback when Simple Icons has no brand). */
function fav(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

/**
 * Ordered logo candidates per P2P payment method code.
 * Prefer Simple Icons brand marks; fall back to real favicons / local assets.
 */
export const P2P_PAYMENT_LOGO_CANDIDATES: Record<string, string[]> = {
  openpay: [OUSD_LOGO_URL, "/ousd-logo.svg"],
  bank_transfer: ["/p2p-pay/bank-transfer.svg", si("contactlesspayment"), fav("swift.com")],
  paypal: [si("paypal"), fav("paypal.com")],
  wise: [si("wise"), fav("wise.com")],
  payoneer: [si("payoneer"), fav("payoneer.com")],
  skrill: [fav("skrill.com"), si("paysafecard")],
  neteller: [fav("neteller.com"), fav("paysafe.com")],
  western_union: [si("westernunion"), fav("westernunion.com")],
  moneygram: [si("moneygram"), fav("moneygram.com")],
  remitly: [fav("remitly.com")],
  worldremit: [fav("worldremit.com")],
  swift: [si("swift"), fav("swift.com")],
  sepa: [si("sepa"), fav("sepaforecorporates.com")],
  cash_in_person: ["/p2p-pay/cash.svg", si("contactlesspayment")],

  zelle: [si("zelle"), fav("zellepay.com")],
  cash_app: [si("cashapp"), fav("cash.app")],
  venmo: [si("venmo"), fav("venmo.com")],
  chime: [fav("chime.com")],
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

  revolut: [si("revolut"), fav("revolut.com")],
  bizum: [fav("bizum.es")],
  blik: [fav("blik.com")],
  multibanco: [fav("multibanco.pt"), fav("sibs.pt")],
  mb_way: [fav("mbway.pt"), fav("sibs.pt")],
  swish: [fav("swish.nu")],
  vipps: [fav("vipps.no")],
  mobilepay: [fav("mobilepay.dk")],
  twint: [fav("twint.ch")],
  ideal: [fav("ideal.nl")],
  bancontact: [fav("bancontact.com")],
  giropay: [fav("giropay.de")],
  sofort: [si("klarna"), fav("klarna.com")],
  paysafecard: [fav("paysafecard.com")],
  fps_uk: ["/p2p-pay/bank-transfer.svg", fav("pay.uk")],

  gcash: [fav("gcash.com"), fav("mynt.xyz")],
  maya: [fav("maya.ph"), fav("paymaya.com")],
  grabpay: [si("grab"), fav("grab.com")],
  shopeepay: [si("shopee"), fav("shopee.com")],
  gopay: [si("gojek"), fav("gojek.com")],
  ovo: [fav("ovo.id")],
  dana: [fav("dana.id")],
  linkaja: [fav("linkaja.id")],
  qris: [fav("qris.id"), "/p2p-pay/bank-transfer.svg"],
  promptpay: [fav("kasikornbank.com"), fav("scb.co.th")],
  true_money: [fav("truemoney.com")],
  momo: [fav("momo.vn")],
  zalopay: [fav("zalopay.vn")],
  viettel_money: [fav("viettelmoney.vn"), fav("viettel.com.vn")],
  touch_n_go: [fav("touchngo.com.my"), fav("tngdigital.com.my")],
  boost: [si("boost"), fav("myboost.com.my")],
  fpx: [fav("paynet.my"), fav("fpx.com.my")],
  paynow: [fav("abs.org.sg"), fav("dbs.com.sg")],
  paylah: [fav("dbs.com.sg")],

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
  kakao_pay: [si("kakao"), fav("kakaopay.com")],
  toss: [fav("toss.im")],
  naver_pay: [si("naver"), fav("pay.naver.com")],
  paypay: [fav("paypay.ne.jp")],
  line_pay: [si("line"), fav("line.me")],
  bank_transfer_jp: ["/p2p-pay/bank-transfer.svg", fav("boj.or.jp")],
  bank_transfer_kr: ["/p2p-pay/bank-transfer.svg", fav("bok.or.kr")],
  bank_transfer_cn: ["/p2p-pay/bank-transfer.svg", fav("pbc.gov.cn")],
  bank_transfer_tw: ["/p2p-pay/bank-transfer.svg", fav("cbc.gov.tw")],
  bkash: [fav("bkash.com"), fav("bka.sh")],
  nagad: [fav("nagad.com.bd")],
  easypaisa: [fav("easypaisa.com.pk")],
  jazzcash: [fav("jazzcash.com.pk")],

  stc_pay: [fav("stcpay.com.sa")],
  mada: [fav("mada.com.sa")],
  bank_transfer_ae: ["/p2p-pay/bank-transfer.svg", fav("centralbank.ae")],
  bank_transfer_sa: ["/p2p-pay/bank-transfer.svg", fav("sama.gov.sa")],
  instapay_eg: [fav("instapay.eg"), fav("cbe.org.eg")],
  vodafone_cash: [si("vodafone"), fav("vodafone.com.eg")],
  fawry: [fav("fawry.com")],
  bank_transfer_tr: ["/p2p-pay/bank-transfer.svg", fav("tcmb.gov.tr")],
  papara: [fav("papara.com")],

  mpesa: [fav("safaricom.co.ke"), fav("mpesa.com")],
  airtel_money: [si("airtel"), fav("airtel.in")],
  orange_money: [si("orange"), fav("orange.com")],
  mtn_momo: [fav("mtn.com"), fav("mtn.co.za")],
  opay: [fav("opayweb.com"), fav("opay.com")],
  palmpay: [fav("palmpay.com")],
  bank_transfer_ng: ["/p2p-pay/bank-transfer.svg", fav("cbn.gov.ng")],
  bank_transfer_za: ["/p2p-pay/bank-transfer.svg", fav("resbank.co.za")],
  chipper_cash: [fav("chippercash.com")],

  payid: [fav("payid.com.au"), fav("auspaynet.com.au")],
  osko: [fav("osko.com.au"), fav("auspaynet.com.au")],
  bank_transfer_au: ["/p2p-pay/bank-transfer.svg", fav("rba.gov.au")],
  bank_transfer_nz: ["/p2p-pay/bank-transfer.svg", fav("rbnz.govt.nz")],
};

export function logoCandidatesForP2pPayment(code: string): string[] {
  return P2P_PAYMENT_LOGO_CANDIDATES[code] ?? ["/p2p-pay/bank-transfer.svg"];
}

export function logoUrlForP2pPayment(code: string): string {
  return logoCandidatesForP2pPayment(code)[0]!;
}
