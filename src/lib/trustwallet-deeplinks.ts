/**
 * Trust Wallet deep links (no API secrets).
 * https://github.com/trustwallet/wallet-core
 * https://developer.trustwallet.com
 */

/** Open Trust Wallet coin / token screen (mobile). */
export function trustWalletAssetDeepLink(assetId: string): string {
  const id = assetId.startsWith("c") ? assetId : `c${assetId}`;
  return `https://link.trustwallet.com/open_coin?asset=${encodeURIComponent(id)}`;
}

export function trustWalletCoinDeepLink(coinId: number): string {
  return trustWalletAssetDeepLink(`c${coinId}`);
}

/** Trust Wallet assets CDN blockchain logo. */
export function trustWalletBlockchainLogo(slug: string): string {
  return `https://assets.trustwalletapp.com/blockchains/${slug}/info/logo.png`;
}
