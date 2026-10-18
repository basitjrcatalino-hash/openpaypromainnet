-- Philippines P2P payment methods (banks, digital banks, e-wallets, rails)
-- + logo_url / logo_dark_url for Binance/OKX-style brand logos.
-- Skips codes that already exist (openpay, bank_transfer, cash_in_person, gcash, maya, grabpay).

alter table public.p2p_payment_methods
  add column if not exists logo_url text;

alter table public.p2p_payment_methods
  add column if not exists logo_dark_url text;

comment on column public.p2p_payment_methods.logo_url is
  'Primary brand logo (SVG/PNG URL). Frontend may also use p2p-payment-logos.ts.';
comment on column public.p2p_payment_methods.logo_dark_url is
  'Optional dark-mode logo URL.';
comment on column public.p2p_payment_methods.region is
  'UI group: Global | Popular | Americas | Europe | Asia | Philippines | Africa | Middle East | Oceania';

-- Refresh existing PH e-wallets into Philippines region + logos (do not re-insert).
update public.p2p_payment_methods set
  region = 'Philippines',
  keywords = case code
    when 'gcash' then 'philippines glife gcash ewallet'
    when 'maya' then 'philippines paymaya maya ewallet'
    when 'grabpay' then 'philippines sea grab grabpay ewallet'
    else keywords
  end,
  logo_url = case code
    when 'gcash' then 'https://cdn.simpleicons.org/gcash'
    when 'maya' then 'https://cdn.simpleicons.org/maya'
    when 'grabpay' then 'https://cdn.simpleicons.org/grab'
    else logo_url
  end,
  updated_at = now()
where code in ('gcash', 'maya', 'grabpay');

update public.p2p_payment_methods set
  logo_url = coalesce(logo_url, 'https://openpaypro.space/logo.png'),
  updated_at = now()
where code = 'openpay';

insert into public.p2p_payment_methods
  (code, name, icon, region, keywords, sort_order, is_active, logo_url)
values
  -- Rails
  ('bancnet', 'BancNet', '🏧', 'Philippines', 'philippines atm bancnet', 550, true, null),
  ('instapay', 'InstaPay', '⚡', 'Philippines', 'philippines instant transfer bsp', 551, true, null),
  ('pesonet', 'PESONet', '🏦', 'Philippines', 'philippines batch transfer bsp', 552, true, null),
  ('qr_ph', 'QR Ph', '📱', 'Philippines', 'philippines qrph qr ph', 553, true, null),

  -- Major banks (PHLogos where available)
  ('bdo', 'BDO Unibank', '🔵', 'Philippines', 'philippines bdo bank', 560, true, 'https://phlogos.com/logos/bdo.svg'),
  ('bpi', 'BPI', '🔴', 'Philippines', 'philippines bpi bank', 561, true, 'https://phlogos.com/logos/bpi.svg'),
  ('metrobank', 'Metrobank', '🔵', 'Philippines', 'philippines metrobank', 562, true, 'https://phlogos.com/logos/metrobank.svg'),
  ('unionbank', 'UnionBank', '🟠', 'Philippines', 'philippines unionbank ub', 563, true, 'https://phlogos.com/logos/unionbank.svg'),
  ('pnb', 'Philippine National Bank', '🔵', 'Philippines', 'philippines pnb', 564, true, 'https://phlogos.com/logos/pnb.svg'),
  ('chinabank', 'China Bank', '🔴', 'Philippines', 'philippines chinabank china bank', 565, true, 'https://phlogos.com/logos/chinabank.svg'),
  ('security_bank', 'Security Bank', '🟢', 'Philippines', 'philippines security bank', 566, true, 'https://phlogos.com/logos/securitybank.svg'),
  ('landbank', 'LandBank', '🟢', 'Philippines', 'philippines landbank lbp', 567, true, null),
  ('dbp', 'Development Bank of the Philippines', '🔵', 'Philippines', 'philippines dbp', 568, true, null),
  ('eastwest', 'EastWest Bank', '🟠', 'Philippines', 'philippines eastwest', 569, true, null),
  ('rcbc', 'RCBC', '🔵', 'Philippines', 'philippines rcbc', 570, true, null),
  ('psbank', 'PSBank', '🔴', 'Philippines', 'philippines psbank', 571, true, null),
  ('aub', 'Asia United Bank', '🔵', 'Philippines', 'philippines aub', 572, true, null),
  ('bank_of_commerce', 'Bank of Commerce', '🔵', 'Philippines', 'philippines bankcom bank of commerce', 573, true, null),
  ('pbcom', 'PBCOM', '🔵', 'Philippines', 'philippines pbcom', 574, true, null),
  ('maybank', 'Maybank Philippines', '🟡', 'Philippines', 'philippines maybank', 575, true, null),
  ('cimb', 'CIMB Bank PH', '🔴', 'Philippines', 'philippines cimb', 576, true, null),
  ('gotyme', 'GoTyme Bank', '🟢', 'Philippines', 'philippines gotyme digital bank', 577, true, null),
  ('seabank', 'SeaBank Philippines', '🟠', 'Philippines', 'philippines seabank shopee', 578, true, null),
  ('ownbank', 'OwnBank', '💜', 'Philippines', 'philippines ownbank digital', 579, true, null),
  ('tonik', 'Tonik Bank', '🩷', 'Philippines', 'philippines tonik digital bank', 580, true, null),
  ('unobank', 'UNO Digital Bank', '🖤', 'Philippines', 'philippines unobank uno digital', 581, true, null),
  ('uniondigital', 'UnionDigital Bank', '🟠', 'Philippines', 'philippines uniondigital union bank digital', 582, true, null),
  ('mayabank', 'Maya Bank', '💚', 'Philippines', 'philippines maya bank digital', 583, true, 'https://cdn.simpleicons.org/maya'),

  -- E-wallets not already listed
  ('coinsph', 'Coins.ph', '🟡', 'Philippines', 'philippines coins ph wallet crypto', 630, true, null),
  ('paymaya_business', 'Maya Business', '💚', 'Philippines', 'philippines maya business paymaya merchant', 631, true, 'https://cdn.simpleicons.org/maya'),
  ('diskartech', 'DiskarTech', '🔵', 'Philippines', 'philippines diskartech rcbc', 632, true, null),
  ('hellomoney', 'HelloMoney (AUB)', '🩵', 'Philippines', 'philippines hellomoney aub', 633, true, null),
  ('vipwallet', 'VIP Wallet', '💜', 'Philippines', 'philippines vip wallet', 634, true, null),
  ('traxionpay', 'Traxion Pay', '🟠', 'Philippines', 'philippines traxion pay', 635, true, null),
  ('ecpay', 'ECPay', '🔵', 'Philippines', 'philippines ecpay bills payment', 636, true, null)
on conflict (code) do update set
  name = excluded.name,
  icon = excluded.icon,
  region = excluded.region,
  keywords = excluded.keywords,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  logo_url = coalesce(excluded.logo_url, public.p2p_payment_methods.logo_url),
  updated_at = now();
