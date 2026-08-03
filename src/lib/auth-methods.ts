/**
 * Canonical OpenPay Pro sign-in methods.
 * Admin toggles visibility via `auth_methods.enabled` (hide during maintenance).
 */
export type AuthMethodKey =
  | "openpay"
  | "phantom"
  | "solana"
  | "walletconnect"
  | "metamask"
  | "pi"
  | "telegram"
  | "email"
  | "privy";

export type AuthMethodSeed = {
  method_key: AuthMethodKey;
  label: string;
  description: string;
  sort_order: number;
  enabled: boolean;
};

export const AUTH_METHOD_CATALOG: readonly AuthMethodSeed[] = [
  {
    method_key: "openpay",
    label: "OpenPay",
    description: "Sign in with your OpenPay account",
    sort_order: 0,
    enabled: true,
  },
  {
    method_key: "phantom",
    label: "Phantom",
    description: "Extension · Google · Apple",
    sort_order: 1,
    enabled: true,
  },
  {
    method_key: "solana",
    label: "Solana",
    description: "Phantom extension SIWS",
    sort_order: 2,
    enabled: true,
  },
  {
    method_key: "walletconnect",
    label: "WalletConnect",
    description: "EVM wallets",
    sort_order: 3,
    enabled: true,
  },
  {
    method_key: "metamask",
    label: "MetaMask",
    description: "Social · Embedded",
    sort_order: 4,
    enabled: true,
  },
  {
    method_key: "pi",
    label: "Pi Network",
    description: "Sign in with your Pi account",
    sort_order: 5,
    enabled: true,
  },
  {
    method_key: "telegram",
    label: "Telegram",
    description: "Telegram Login",
    sort_order: 6,
    enabled: true,
  },
  {
    method_key: "email",
    label: "Email",
    description: "Email and password",
    sort_order: 7,
    enabled: true,
  },
  {
    method_key: "privy",
    label: "Privy",
    description: "Google · Apple · Email · SMS",
    sort_order: 8,
    enabled: true,
  },
] as const;

export const AUTH_METHOD_KEYS = AUTH_METHOD_CATALOG.map((m) => m.method_key);

export function isAuthMethodKey(v: string): v is AuthMethodKey {
  return (AUTH_METHOD_KEYS as readonly string[]).includes(v);
}

export type AuthMethodRow = {
  id: string;
  method_key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  sort_order: number;
  maintenance_message: string | null;
};

/** Public (pre-login) fetch of auth method flags. Falls back to all-enabled catalog. */
export async function fetchAuthMethodFlags(
  supabase: { from: (t: string) => any },
): Promise<Record<AuthMethodKey, { enabled: boolean; message: string | null }>> {
  const fallback = Object.fromEntries(
    AUTH_METHOD_CATALOG.map((m) => [m.method_key, { enabled: true, message: null }]),
  ) as Record<AuthMethodKey, { enabled: boolean; message: string | null }>;

  try {
    const { data, error } = await supabase
      .from("auth_methods")
      .select("method_key, enabled, maintenance_message");
    if (error || !data?.length) return fallback;
    const out = { ...fallback };
    for (const row of data as {
      method_key: string;
      enabled: boolean;
      maintenance_message: string | null;
    }[]) {
      if (!isAuthMethodKey(row.method_key)) continue;
      out[row.method_key] = {
        enabled: !!row.enabled,
        message: row.maintenance_message ?? null,
      };
    }
    return out;
  } catch {
    return fallback;
  }
}
