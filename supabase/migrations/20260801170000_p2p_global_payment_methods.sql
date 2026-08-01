-- Global P2P payment methods (real rails used worldwide) + searchable region metadata.

alter table public.p2p_payment_methods
  add column if not exists region text not null default 'Global';

alter table public.p2p_payment_methods
  add column if not exists keywords text not null default '';

comment on column public.p2p_payment_methods.region is
  'UI group: Global | Popular | Americas | Europe | Asia | Africa | Middle East | Oceania';

create index if not exists p2p_payment_methods_region_idx
  on public.p2p_payment_methods (region, sort_order);

-- Keep existing rows; refresh metadata for the original set.
update public.p2p_payment_methods set
  region = case code
    when 'bank_transfer' then 'Global'
    when 'gcash' then 'Asia'
    when 'maya' then 'Asia'
    when 'paypal' then 'Global'
    when 'wise' then 'Global'
    when 'revolut' then 'Europe'
    when 'openpay' then 'Popular'
    else region
  end,
  keywords = case code
    when 'bank_transfer' then 'bank wire local deposit iban'
    when 'gcash' then 'philippines glife'
    when 'maya' then 'philippines paymaya'
    when 'paypal' then 'xoom'
    when 'wise' then 'transferwise'
    when 'revolut' then 'eu uk'
    when 'openpay' then 'balance openpay pro'
    else keywords
  end
where code in ('bank_transfer','gcash','maya','paypal','wise','revolut','openpay');

-- Upsert a broad real-world catalog (Binance/OKX-style coverage).
insert into public.p2p_payment_methods (code, name, icon, region, keywords, sort_order, is_active)
values
  -- Popular / Global
  ('openpay', 'OpenPay Balance', '◎', 'Popular', 'balance openpay pro', 5, true),
  ('bank_transfer', 'Bank Transfer', '🏦', 'Global', 'bank wire local deposit iban', 10, true),
  ('paypal', 'PayPal', '🅿️', 'Global', 'xoom paypal', 20, true),
  ('wise', 'Wise', '🌍', 'Global', 'transferwise', 30, true),
  ('payoneer', 'Payoneer', '💳', 'Global', 'payoneer card', 40, true),
  ('skrill', 'Skrill', '💜', 'Global', 'moneybookers', 50, true),
  ('neteller', 'Neteller', '💚', 'Global', 'paysafe', 60, true),
  ('western_union', 'Western Union', '🟡', 'Global', 'wu remittance', 70, true),
  ('moneygram', 'MoneyGram', '🔴', 'Global', 'remittance', 80, true),
  ('remitly', 'Remitly', '🔵', 'Global', 'remittance', 90, true),
  ('worldremit', 'WorldRemit', '🌐', 'Global', 'remittance', 100, true),
  ('swift', 'SWIFT / Wire', '✈️', 'Global', 'international wire bic', 110, true),
  ('sepa', 'SEPA Transfer', '🇪🇺', 'Europe', 'iban euro sepa', 120, true),
  ('cash_in_person', 'Cash in Person', '💵', 'Global', 'cash meetup face to face', 130, true),

  -- Americas
  ('zelle', 'Zelle', '🟪', 'Americas', 'usa bank zelle', 200, true),
  ('cash_app', 'Cash App', '🟩', 'Americas', 'cashapp square usa', 210, true),
  ('venmo', 'Venmo', '🔵', 'Americas', 'paypal venmo usa', 220, true),
  ('chime', 'Chime', '🟢', 'Americas', 'usa neobank', 230, true),
  ('interac', 'Interac e-Transfer', '🍁', 'Americas', 'canada etransfer', 240, true),
  ('pix', 'PIX', '🇧🇷', 'Americas', 'brazil instant pix', 250, true),
  ('picpay', 'PicPay', '🟢', 'Americas', 'brazil', 260, true),
  ('mercado_pago', 'Mercado Pago', '💙', 'Americas', 'latam mercadopago', 270, true),
  ('spei', 'SPEI', '🇲🇽', 'Americas', 'mexico bank spei', 280, true),
  ('oxxo', 'OXXO', '🟠', 'Americas', 'mexico cash', 290, true),
  ('nequi', 'Nequi', '🟣', 'Americas', 'colombia', 300, true),
  ('daviplata', 'Daviplata', '🔴', 'Americas', 'colombia davivienda', 310, true),
  ('yape', 'Yape', '💜', 'Americas', 'peru bcp', 320, true),
  ('plin', 'Plin', '🔵', 'Americas', 'peru', 330, true),
  ('banco_inter', 'Banco Inter', '🧡', 'Americas', 'brazil', 340, true),
  ('uala', 'Ualá', '🩵', 'Americas', 'argentina mexico', 350, true),
  ('pago_movil', 'Pago Móvil', '🇻🇪', 'Americas', 'venezuela', 360, true),

  -- Europe
  ('revolut', 'Revolut', '⚡', 'Europe', 'eu uk revolut', 400, true),
  ('bizum', 'Bizum', '🇪🇸', 'Europe', 'spain', 410, true),
  ('blik', 'BLIK', '🇵🇱', 'Europe', 'poland', 420, true),
  ('multibanco', 'Multibanco', '🇵🇹', 'Europe', 'portugal', 430, true),
  ('mb_way', 'MB Way', '🇵🇹', 'Europe', 'portugal mbway', 440, true),
  ('swish', 'Swish', '🇸🇪', 'Europe', 'sweden', 450, true),
  ('vipps', 'Vipps', '🇳🇴', 'Europe', 'norway', 460, true),
  ('mobilepay', 'MobilePay', '🇩🇰', 'Europe', 'denmark finland', 470, true),
  ('twint', 'TWINT', '🇨🇭', 'Europe', 'switzerland', 480, true),
  ('ideal', 'iDEAL', '🇳🇱', 'Europe', 'netherlands', 490, true),
  ('bancontact', 'Bancontact', '🇧🇪', 'Europe', 'belgium', 500, true),
  ('giropay', 'Giropay', '🇩🇪', 'Europe', 'germany', 510, true),
  ('sofort', 'Sofort / Klarna', '🩷', 'Europe', 'klarna sofort', 520, true),
  ('paysafecard', 'Paysafecard', '🎫', 'Europe', 'voucher', 530, true),
  ('fps_uk', 'Faster Payments (UK)', '🇬🇧', 'Europe', 'uk fps bank', 540, true),

  -- Asia — PH / SEA
  ('gcash', 'GCash', '💙', 'Asia', 'philippines glife', 600, true),
  ('maya', 'Maya', '💚', 'Asia', 'philippines paymaya', 610, true),
  ('grabpay', 'GrabPay', '🟢', 'Asia', 'sea grab', 620, true),
  ('shopeepay', 'ShopeePay', '🧡', 'Asia', 'sea shopee', 630, true),
  ('gopay', 'GoPay', '🟢', 'Asia', 'indonesia gojek', 640, true),
  ('ovo', 'OVO', '💜', 'Asia', 'indonesia', 650, true),
  ('dana', 'DANA', '🔵', 'Asia', 'indonesia', 660, true),
  ('linkaja', 'LinkAja', '🔴', 'Asia', 'indonesia', 670, true),
  ('qris', 'QRIS', '🇮🇩', 'Asia', 'indonesia qris', 680, true),
  ('promptpay', 'PromptPay', '🇹🇭', 'Asia', 'thailand', 690, true),
  ('true_money', 'TrueMoney', '🟠', 'Asia', 'thailand', 700, true),
  ('momo', 'MoMo', '🩷', 'Asia', 'vietnam', 710, true),
  ('zalopay', 'ZaloPay', '🔵', 'Asia', 'vietnam', 720, true),
  ('viettel_money', 'Viettel Money', '🔴', 'Asia', 'vietnam', 730, true),
  ('touch_n_go', 'Touch ''n Go', '🇲🇾', 'Asia', 'malaysia tng', 740, true),
  ('boost', 'Boost', '🔴', 'Asia', 'malaysia', 750, true),
  ('fpx', 'FPX', '🇲🇾', 'Asia', 'malaysia bank', 760, true),
  ('paynow', 'PayNow', '🇸🇬', 'Asia', 'singapore', 770, true),
  ('paylah', 'PayLah!', '🇸🇬', 'Asia', 'dbs singapore', 780, true),

  -- Asia — South / East
  ('upi', 'UPI', '🇮🇳', 'Asia', 'india upi gpay phonepe', 800, true),
  ('paytm', 'Paytm', '🔵', 'Asia', 'india', 810, true),
  ('phonepe', 'PhonePe', '💜', 'Asia', 'india', 820, true),
  ('google_pay_in', 'Google Pay (India)', '🌈', 'Asia', 'gpay tez india', 830, true),
  ('imps', 'IMPS', '🇮🇳', 'Asia', 'india bank instant', 840, true),
  ('neft', 'NEFT / RTGS', '🏦', 'Asia', 'india bank', 850, true),
  ('alipay', 'Alipay', '🩵', 'Asia', 'china alipay', 860, true),
  ('wechat_pay', 'WeChat Pay', '💚', 'Asia', 'weixin china', 870, true),
  ('fps_hk', 'FPS (Hong Kong)', '🇭🇰', 'Asia', 'hong kong faster', 880, true),
  ('payme_hk', 'PayMe', '💙', 'Asia', 'hsbc hong kong', 890, true),
  ('kakao_pay', 'Kakao Pay', '💛', 'Asia', 'korea', 900, true),
  ('toss', 'Toss', '🔵', 'Asia', 'korea', 910, true),
  ('naver_pay', 'Naver Pay', '🟢', 'Asia', 'korea', 920, true),
  ('paypay', 'PayPay', '🔴', 'Asia', 'japan', 930, true),
  ('line_pay', 'LINE Pay', '💚', 'Asia', 'japan taiwan thailand', 940, true),
  ('bank_transfer_jp', 'Bank Transfer (Japan)', '🇯🇵', 'Asia', 'furikomi japan', 950, true),
  ('bank_transfer_kr', 'Bank Transfer (Korea)', '🇰🇷', 'Asia', 'korea bank', 960, true),
  ('bank_transfer_cn', 'Bank Transfer (China)', '🇨🇳', 'Asia', 'china bank', 970, true),
  ('bank_transfer_tw', 'Bank Transfer (Taiwan)', '🇹🇼', 'Asia', 'taiwan bank', 980, true),
  ('bkash', 'bKash', '🩷', 'Asia', 'bangladesh bkash', 990, true),
  ('nagad', 'Nagad', '🟠', 'Asia', 'bangladesh', 1000, true),
  ('easypaisa', 'Easypaisa', '🟢', 'Asia', 'pakistan', 1010, true),
  ('jazzcash', 'JazzCash', '🔴', 'Asia', 'pakistan', 1020, true),

  -- Middle East
  ('stc_pay', 'stc pay', '🟣', 'Middle East', 'saudi arabia', 1100, true),
  ('mada', 'mada', '🇸🇦', 'Middle East', 'saudi card network', 1110, true),
  ('bank_transfer_ae', 'Bank Transfer (UAE)', '🇦🇪', 'Middle East', 'uae emirates', 1120, true),
  ('bank_transfer_sa', 'Bank Transfer (Saudi)', '🇸🇦', 'Middle East', 'ksa', 1130, true),
  ('instapay_eg', 'InstaPay', '🇪🇬', 'Middle East', 'egypt', 1140, true),
  ('vodafone_cash', 'Vodafone Cash', '🔴', 'Middle East', 'egypt', 1150, true),
  ('fawry', 'Fawry', '🟡', 'Middle East', 'egypt', 1160, true),
  ('bank_transfer_tr', 'Bank Transfer (Turkey)', '🇹🇷', 'Middle East', 'turkey havale eft', 1170, true),
  ('papara', 'Papara', '🖤', 'Middle East', 'turkey', 1180, true),

  -- Africa
  ('mpesa', 'M-Pesa', '🟢', 'Africa', 'kenya tanzania safaricom', 1200, true),
  ('airtel_money', 'Airtel Money', '🔴', 'Africa', 'africa airtel', 1210, true),
  ('orange_money', 'Orange Money', '🟠', 'Africa', 'west africa', 1220, true),
  ('mtn_momo', 'MTN MoMo', '💛', 'Africa', 'ghana uganda africa', 1230, true),
  ('opay', 'OPay', '🟢', 'Africa', 'nigeria', 1240, true),
  ('palmpay', 'PalmPay', '💜', 'Africa', 'nigeria', 1250, true),
  ('bank_transfer_ng', 'Bank Transfer (Nigeria)', '🇳🇬', 'Africa', 'naira nigeria', 1260, true),
  ('bank_transfer_za', 'Bank Transfer (South Africa)', '🇿🇦', 'Africa', 'eft za', 1270, true),
  ('chipper_cash', 'Chipper Cash', '🩵', 'Africa', 'africa wallet', 1280, true),

  -- Oceania
  ('payid', 'PayID', '🇦🇺', 'Oceania', 'australia', 1300, true),
  ('osko', 'Osko', '🇦🇺', 'Oceania', 'australia npp', 1310, true),
  ('bank_transfer_au', 'Bank Transfer (Australia)', '🇦🇺', 'Oceania', 'bsb australia', 1320, true),
  ('bank_transfer_nz', 'Bank Transfer (New Zealand)', '🇳🇿', 'Oceania', 'nz bank', 1330, true)
on conflict (code) do update set
  name = excluded.name,
  icon = excluded.icon,
  region = excluded.region,
  keywords = excluded.keywords,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
