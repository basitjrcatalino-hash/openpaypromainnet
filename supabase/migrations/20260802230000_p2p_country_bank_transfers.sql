-- Country-specific bank transfers with FlagCDN SVG logos (Binance/OKX pattern).
-- Country banks → flag; e-wallets → brand logo; rails → program/custom icon.
-- Does not re-insert codes that already exist without change of meaning.

insert into public.p2p_payment_methods
  (code, name, icon, region, keywords, sort_order, is_active, logo_url)
values
  -- Americas
  ('bank_transfer_us', 'Bank Transfer (United States)', '🇺🇸', 'Americas', 'usa ach wire bank', 365, true, 'https://flagcdn.com/us.svg'),
  ('bank_transfer_ca', 'Bank Transfer (Canada)', '🇨🇦', 'Americas', 'canada etransfer bank', 366, true, 'https://flagcdn.com/ca.svg'),
  ('bank_transfer_mx', 'Bank Transfer (Mexico)', '🇲🇽', 'Americas', 'mexico spei bank', 367, true, 'https://flagcdn.com/mx.svg'),
  ('bank_transfer_br', 'Bank Transfer (Brazil)', '🇧🇷', 'Americas', 'brazil ted doc bank', 368, true, 'https://flagcdn.com/br.svg'),
  ('bank_transfer_ar', 'Bank Transfer (Argentina)', '🇦🇷', 'Americas', 'argentina bank cbu', 369, true, 'https://flagcdn.com/ar.svg'),
  ('bank_transfer_co', 'Bank Transfer (Colombia)', '🇨🇴', 'Americas', 'colombia bank', 370, true, 'https://flagcdn.com/co.svg'),
  ('bank_transfer_pe', 'Bank Transfer (Peru)', '🇵🇪', 'Americas', 'peru bank', 371, true, 'https://flagcdn.com/pe.svg'),

  -- Europe
  ('bank_transfer_gb', 'Bank Transfer (United Kingdom)', '🇬🇧', 'Europe', 'uk fps bank faster payments', 541, true, 'https://flagcdn.com/gb.svg'),
  ('bank_transfer_fr', 'Bank Transfer (France)', '🇫🇷', 'Europe', 'france sepa bank', 542, true, 'https://flagcdn.com/fr.svg'),
  ('bank_transfer_de', 'Bank Transfer (Germany)', '🇩🇪', 'Europe', 'germany sepa bank', 543, true, 'https://flagcdn.com/de.svg'),
  ('bank_transfer_es', 'Bank Transfer (Spain)', '🇪🇸', 'Europe', 'spain sepa bank', 544, true, 'https://flagcdn.com/es.svg'),
  ('bank_transfer_it', 'Bank Transfer (Italy)', '🇮🇹', 'Europe', 'italy sepa bank', 545, true, 'https://flagcdn.com/it.svg'),
  ('bank_transfer_nl', 'Bank Transfer (Netherlands)', '🇳🇱', 'Europe', 'netherlands sepa ideal bank', 546, true, 'https://flagcdn.com/nl.svg'),
  ('bank_transfer_be', 'Bank Transfer (Belgium)', '🇧🇪', 'Europe', 'belgium sepa bank', 547, true, 'https://flagcdn.com/be.svg'),
  ('bank_transfer_ch', 'Bank Transfer (Switzerland)', '🇨🇭', 'Europe', 'switzerland bank', 548, true, 'https://flagcdn.com/ch.svg'),
  ('bank_transfer_se', 'Bank Transfer (Sweden)', '🇸🇪', 'Europe', 'sweden bank swish', 549, true, 'https://flagcdn.com/se.svg'),
  ('bank_transfer_no', 'Bank Transfer (Norway)', '🇳🇴', 'Europe', 'norway bank vipps', 585, true, 'https://flagcdn.com/no.svg'),
  ('bank_transfer_dk', 'Bank Transfer (Denmark)', '🇩🇰', 'Europe', 'denmark bank mobilepay', 586, true, 'https://flagcdn.com/dk.svg'),
  ('bank_transfer_pl', 'Bank Transfer (Poland)', '🇵🇱', 'Europe', 'poland bank blik', 587, true, 'https://flagcdn.com/pl.svg'),
  ('bank_transfer_pt', 'Bank Transfer (Portugal)', '🇵🇹', 'Europe', 'portugal bank multibanco', 588, true, 'https://flagcdn.com/pt.svg'),
  ('bank_transfer_ie', 'Bank Transfer (Ireland)', '🇮🇪', 'Europe', 'ireland sepa bank', 589, true, 'https://flagcdn.com/ie.svg'),

  -- Asia / PH
  ('bank_transfer_ph', 'Bank Transfer (Philippines)', '🇵🇭', 'Philippines', 'philippines bank instapay pesonet', 554, true, 'https://flagcdn.com/ph.svg'),
  ('bank_transfer_in', 'Bank Transfer (India)', '🇮🇳', 'Asia', 'india bank neft imps rtgs', 851, true, 'https://flagcdn.com/in.svg'),
  ('bank_transfer_hk', 'Bank Transfer (Hong Kong)', '🇭🇰', 'Asia', 'hong kong bank fps', 981, true, 'https://flagcdn.com/hk.svg'),
  ('bank_transfer_sg', 'Bank Transfer (Singapore)', '🇸🇬', 'Asia', 'singapore bank paynow', 982, true, 'https://flagcdn.com/sg.svg'),
  ('bank_transfer_my', 'Bank Transfer (Malaysia)', '🇲🇾', 'Asia', 'malaysia bank fpx', 983, true, 'https://flagcdn.com/my.svg'),
  ('bank_transfer_id', 'Bank Transfer (Indonesia)', '🇮🇩', 'Asia', 'indonesia bank transfer', 984, true, 'https://flagcdn.com/id.svg'),
  ('bank_transfer_th', 'Bank Transfer (Thailand)', '🇹🇭', 'Asia', 'thailand bank promptpay', 985, true, 'https://flagcdn.com/th.svg'),
  ('bank_transfer_vn', 'Bank Transfer (Vietnam)', '🇻🇳', 'Asia', 'vietnam bank', 986, true, 'https://flagcdn.com/vn.svg'),
  ('bank_transfer_bd', 'Bank Transfer (Bangladesh)', '🇧🇩', 'Asia', 'bangladesh bank', 1001, true, 'https://flagcdn.com/bd.svg'),
  ('bank_transfer_pk', 'Bank Transfer (Pakistan)', '🇵🇰', 'Asia', 'pakistan bank', 1021, true, 'https://flagcdn.com/pk.svg'),

  -- Middle East / Africa extras
  ('bank_transfer_eg', 'Bank Transfer (Egypt)', '🇪🇬', 'Middle East', 'egypt bank', 1135, true, 'https://flagcdn.com/eg.svg'),
  ('bank_transfer_ke', 'Bank Transfer (Kenya)', '🇰🇪', 'Africa', 'kenya bank', 1275, true, 'https://flagcdn.com/ke.svg')
on conflict (code) do update set
  name = excluded.name,
  icon = excluded.icon,
  region = excluded.region,
  keywords = excluded.keywords,
  sort_order = excluded.sort_order,
  is_active = true,
  logo_url = excluded.logo_url,
  updated_at = now();

-- Refresh flag logos on country bank transfers that already existed.
update public.p2p_payment_methods set
  logo_url = case code
    when 'bank_transfer_jp' then 'https://flagcdn.com/jp.svg'
    when 'bank_transfer_kr' then 'https://flagcdn.com/kr.svg'
    when 'bank_transfer_cn' then 'https://flagcdn.com/cn.svg'
    when 'bank_transfer_tw' then 'https://flagcdn.com/tw.svg'
    when 'bank_transfer_ae' then 'https://flagcdn.com/ae.svg'
    when 'bank_transfer_sa' then 'https://flagcdn.com/sa.svg'
    when 'bank_transfer_tr' then 'https://flagcdn.com/tr.svg'
    when 'bank_transfer_ng' then 'https://flagcdn.com/ng.svg'
    when 'bank_transfer_za' then 'https://flagcdn.com/za.svg'
    when 'bank_transfer_au' then 'https://flagcdn.com/au.svg'
    when 'bank_transfer_nz' then 'https://flagcdn.com/nz.svg'
    else logo_url
  end,
  name = case code
    when 'bank_transfer_kr' then 'Bank Transfer (South Korea)'
    when 'bank_transfer_sa' then 'Bank Transfer (Saudi Arabia)'
    else name
  end,
  updated_at = now()
where code in (
  'bank_transfer_jp','bank_transfer_kr','bank_transfer_cn','bank_transfer_tw',
  'bank_transfer_ae','bank_transfer_sa','bank_transfer_tr',
  'bank_transfer_ng','bank_transfer_za','bank_transfer_au','bank_transfer_nz'
);
