import { AddressType } from "@phantom/react-sdk";

/** Phantom Portal App ID (client-safe). */
export const PHANTOM_APP_ID =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_PHANTOM_APP_ID ?? "").trim()) ||
  "42ba7350-53ef-4b1e-aba6-43f7905b094e";

/** Must match an allowlisted Redirect URL in Phantom Portal. */
export const PHANTOM_REDIRECT_URL =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_PHANTOM_REDIRECT_URL ?? "").trim()) ||
  "https://openpaypro.space/auth/callback";

export const PHANTOM_APP_NAME = "OpenPay Pro";

export const PHANTOM_APP_ICON =
  "https://phantom-portal20240925173430423400000001.s3.ca-central-1.amazonaws.com/icons/2e2b40dc-1916-4d04-8e1d-bdc7c20f63a5.jpg";

export const PHANTOM_PROVIDERS = ["google", "apple", "injected"] as const;

export const PHANTOM_ADDRESS_TYPES = [
  AddressType.solana,
  AddressType.ethereum,
  AddressType.sui,
] as const;

export function getPhantomProviderConfig() {
  return {
    providers: [...PHANTOM_PROVIDERS],
    appId: PHANTOM_APP_ID,
    addressTypes: [...PHANTOM_ADDRESS_TYPES],
    authOptions: {
      redirectUrl: PHANTOM_REDIRECT_URL,
    },
  };
}
