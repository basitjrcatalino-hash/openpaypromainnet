/**
 * Turnkey integration (server only).
 * Docs:
 *  - https://docs.turnkey.com/getting-started/company-wallets-quickstart
 *  - https://docs.turnkey.com/solutions/embedded-wallets/quickstart
 *
 * Two wallet kinds:
 *  - "user"    → embedded wallet, each app user gets a Turnkey sub-organization
 *  - "company" → treasury wallet created directly in the parent organization
 *
 * Both derive a Solana (ed25519) and an EVM (secp256k1) address.
 */
import { Turnkey } from "@turnkey/sdk-server";

export const TURNKEY_API_BASE_URL = "https://api.turnkey.com";

export type TurnkeyEnv = {
  organizationId: string;
  apiPublicKey: string;
  apiPrivateKey: string;
};

export function readTurnkeyEnv(): TurnkeyEnv {
  const organizationId = process.env["TURNKEY_ORGANIZATION_ID"] ?? "";
  const apiPublicKey = process.env["TURNKEY_API_PUBLIC_KEY"] ?? "";
  const apiPrivateKey = process.env["TURNKEY_API_PRIVATE_KEY"] ?? "";
  if (!organizationId || !apiPublicKey || !apiPrivateKey) {
    throw new Error("Turnkey is not configured (missing TURNKEY_* secrets)");
  }
  return { organizationId, apiPublicKey, apiPrivateKey };
}

export function turnkeyClient() {
  const env = readTurnkeyEnv();
  const client = new Turnkey({
    apiBaseUrl: TURNKEY_API_BASE_URL,
    defaultOrganizationId: env.organizationId,
    apiPublicKey: env.apiPublicKey,
    apiPrivateKey: env.apiPrivateKey,
  });
  return { client, api: client.apiClient(), env };
}

/** Solana + EVM accounts derived from one wallet seed. */
export const DEFAULT_ACCOUNTS = [
  {
    curve: "CURVE_SECP256K1",
    pathFormat: "PATH_FORMAT_BIP32",
    path: "m/44'/60'/0'/0/0",
    addressFormat: "ADDRESS_FORMAT_ETHEREUM",
  },
  {
    curve: "CURVE_ED25519",
    pathFormat: "PATH_FORMAT_BIP32",
    path: "m/44'/501'/0'/0'",
    addressFormat: "ADDRESS_FORMAT_SOLANA",
  },
] as const;

export type TurnkeyWalletResult = {
  subOrganizationId: string | null;
  walletId: string;
  evmAddress: string | null;
  solanaAddress: string | null;
};

function splitAddresses(addresses: string[]): {
  evmAddress: string | null;
  solanaAddress: string | null;
} {
  const evmAddress = addresses.find((a) => a.startsWith("0x")) ?? null;
  const solanaAddress = addresses.find((a) => !a.startsWith("0x")) ?? null;
  return { evmAddress, solanaAddress };
}

/**
 * Embedded wallet: one Turnkey sub-organization per app user.
 * The backend API key is registered as a root user so OpenPay Pro can sign
 * on the user's behalf after in-app authentication.
 */
export async function createUserSubOrgWallet(opts: {
  userId: string;
  label: string;
}): Promise<TurnkeyWalletResult> {
  const { api, env } = turnkeyClient();
  const res = await api.createSubOrganization({
    subOrganizationName: `openpay-pro-${opts.userId.slice(0, 8)}`,
    rootQuorumThreshold: 1,
    rootUsers: [
      {
        userName: opts.label || `user-${opts.userId.slice(0, 8)}`,
        apiKeys: [
          {
            apiKeyName: "openpay-pro-backend",
            publicKey: env.apiPublicKey,
            curveType: "API_KEY_CURVE_P256",
          },
        ],
        authenticators: [],
        oauthProviders: [],
      },
    ],
    wallet: {
      walletName: "OpenPay Pro Wallet",
      accounts: [...DEFAULT_ACCOUNTS],
    },
  });

  const addresses = res.wallet?.addresses ?? [];
  return {
    subOrganizationId: res.subOrganizationId,
    walletId: res.wallet?.walletId ?? "",
    ...splitAddresses(addresses),
  };
}

/** Company / treasury wallet created inside the parent organization. */
export async function createCompanyWallet(walletName: string): Promise<TurnkeyWalletResult> {
  const { api } = turnkeyClient();
  const res = await api.createWallet({
    walletName,
    accounts: [...DEFAULT_ACCOUNTS],
  });
  return {
    subOrganizationId: null,
    walletId: res.walletId,
    ...splitAddresses(res.addresses ?? []),
  };
}

/** Sign an arbitrary payload with a Turnkey-managed address. */
export async function signPayload(opts: {
  organizationId?: string | null;
  signWith: string;
  payload: string;
  encoding?: "PAYLOAD_ENCODING_HEXADECIMAL" | "PAYLOAD_ENCODING_TEXT_UTF8";
  hashFunction?: "HASH_FUNCTION_NO_OP" | "HASH_FUNCTION_SHA256" | "HASH_FUNCTION_KECCAK256";
}) {
  const { api, env } = turnkeyClient();
  return api.signRawPayload({
    organizationId: opts.organizationId || env.organizationId,
    signWith: opts.signWith,
    payload: opts.payload,
    encoding: opts.encoding ?? "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: opts.hashFunction ?? "HASH_FUNCTION_NO_OP",
  });
}
