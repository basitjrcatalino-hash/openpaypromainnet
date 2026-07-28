import { AddressType } from "@phantom/react-sdk";

/** Phantom Portal App ID (client-safe). */
export const PHANTOM_APP_ID =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_PHANTOM_APP_ID ?? "").trim()) ||
  "42ba7350-53ef-4b1e-aba6-43f7905b094e";

/**
 * Optional explicit redirect override (must be allowlisted in Phantom Portal).
 * Prefer leaving unset so the SDK uses the current origin + /auth/callback.
 */
export const PHANTOM_REDIRECT_URL_ENV =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_PHANTOM_REDIRECT_URL ?? "").trim()) ||
  "";

/** @deprecated Use getPhantomRedirectUrl() — kept for docs/fallback. */
export const PHANTOM_REDIRECT_URL =
  PHANTOM_REDIRECT_URL_ENV || "https://openpaypro.space/auth/callback";

export const PHANTOM_APP_NAME = "OpenPay Pro";

export const PHANTOM_APP_ICON =
  "https://phantom-portal20240925173430423400000001.s3.ca-central-1.amazonaws.com/icons/2e2b40dc-1916-4d04-8e1d-bdc7c20f63a5.jpg";

export const PHANTOM_PROVIDERS = ["google", "apple", "injected"] as const;

export const PHANTOM_ADDRESS_TYPES = [
  AddressType.solana,
  AddressType.ethereum,
  AddressType.sui,
] as const;

/**
 * Redirect after Google/Apple OAuth. Must exactly match a Phantom Portal Redirect URL
 * and the Allowed Origin must include this page's origin.
 * Docs: https://docs.phantom.com/phantom-portal/configure-urls
 */
export function getPhantomRedirectUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }
  return PHANTOM_REDIRECT_URL;
}

export function getPhantomProviderConfig() {
  return {
    providers: [...PHANTOM_PROVIDERS],
    appId: PHANTOM_APP_ID,
    addressTypes: [...PHANTOM_ADDRESS_TYPES],
    authOptions: {
      redirectUrl: getPhantomRedirectUrl(),
    },
  };
}

/** Origins / redirects to allowlist in Phantom Portal for this project. */
export const PHANTOM_PORTAL_ALLOWLIST_HINTS = [
  "https://openpaypro.space",
  "https://openpaypro.space/auth/callback",
  "https://openpaypromainnet.lovable.app",
  "https://openpaypromainnet.lovable.app/auth/callback",
  "https://openpaypromainnet.vercel.app",
  "https://openpaypromainnet.vercel.app/auth/callback",
] as const;
