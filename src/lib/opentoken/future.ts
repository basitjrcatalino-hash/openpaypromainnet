/** Future integrations — structure only, not wired to production. */
// OpenPay Swap / OpenDEX post-graduation liquidity
// OUSD trading pair
// Token staking & DAO governance
// Airdrops & referral system
// Mobile deep links

export const OPENTOKEN_FUTURE = {
  swap: true,
  opendex: true,
  ousdPair: true,
  staking: false,
  dao: false,
  airdrops: false,
  referrals: false,
} as const;
