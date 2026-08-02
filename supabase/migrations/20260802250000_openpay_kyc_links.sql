-- OpenPay Partner KYC links (applications reviewed on OpenPay /admin-kyc-review).

create table if not exists public.openpay_kyc_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid,
  external_ref text not null,
  status text not null default 'not_submitted',
  rejection_reason text,
  admin_notes text,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_ref)
);

create index if not exists openpay_kyc_links_user_idx
  on public.openpay_kyc_links (user_id, updated_at desc);

create index if not exists openpay_kyc_links_application_idx
  on public.openpay_kyc_links (application_id)
  where application_id is not null;

comment on table public.openpay_kyc_links is
  'Maps OpenPay Pro users to OpenPay Partner KYC applications (source=partner).';

alter table public.openpay_kyc_links enable row level security;

drop policy if exists "Users read their own KYC link" on public.openpay_kyc_links;
create policy "Users read their own KYC link"
  on public.openpay_kyc_links for select to authenticated
  using (user_id = auth.uid());

-- Writes only via service role (submit + webhook)
drop policy if exists "No client writes on KYC links" on public.openpay_kyc_links;
create policy "No client writes on KYC links"
  on public.openpay_kyc_links for all to authenticated
  using (false) with check (false);

grant select on public.openpay_kyc_links to authenticated;
grant all on public.openpay_kyc_links to service_role;
