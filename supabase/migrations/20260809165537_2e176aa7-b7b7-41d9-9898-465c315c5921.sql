-- Column-level security: hide claim_code from ordinary authenticated reads
REVOKE SELECT ON public.airdrop_campaigns FROM authenticated;
GRANT SELECT (
  id, slug, title, subtitle, description, notes, asset, amount_per_claim,
  claim_mode, status, starts_at, ends_at, total_budget, max_claims,
  claimed_count, distributed_amount, require_wallet, require_kyc,
  requirements, cover_url, badge, created_by, created_at, updated_at
) ON public.airdrop_campaigns TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.airdrop_campaigns TO authenticated;
GRANT ALL ON public.airdrop_campaigns TO service_role;