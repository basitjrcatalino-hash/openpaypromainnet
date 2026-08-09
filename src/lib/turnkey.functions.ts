/**
 * Turnkey server functions — embedded (per-user) wallets and company wallets.
 * Handlers keep all Turnkey/admin imports inside so nothing leaks to the client.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TurnkeyWalletRow = {
  id: string;
  kind: "user" | "company";
  label: string | null;
  wallet_id: string;
  sub_organization_id: string | null;
  solana_address: string | null;
  evm_address: string | null;
  created_at: string;
};

/** Configured? (does not expose any secret value) */
export const getTurnkeyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    configured: Boolean(
      process.env["TURNKEY_ORGANIZATION_ID"] &&
        process.env["TURNKEY_API_PUBLIC_KEY"] &&
        process.env["TURNKEY_API_PRIVATE_KEY"],
    ),
  }));

/** The signed-in user's embedded wallet, if any. */
export const getMyTurnkeyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("turnkey_wallets")
      .select("id, kind, label, wallet_id, sub_organization_id, solana_address, evm_address, created_at")
      .eq("user_id", context.userId)
      .eq("kind", "user")
      .maybeSingle();
    return (data as TurnkeyWalletRow | null) ?? null;
  });

/** Create (idempotently) the signed-in user's embedded wallet. */
export const createMyTurnkeyWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("turnkey_wallets")
      .select("id, kind, label, wallet_id, sub_organization_id, solana_address, evm_address, created_at")
      .eq("user_id", context.userId)
      .eq("kind", "user")
      .maybeSingle();
    if (existing) return existing as TurnkeyWalletRow;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, pi_username")
      .eq("id", context.userId)
      .maybeSingle();

    const label =
      (profile?.display_name as string | null) ||
      (profile?.pi_username as string | null) ||
      `user-${context.userId.slice(0, 8)}`;

    const { createUserSubOrgWallet } = await import("./turnkey.server");
    const wallet = await createUserSubOrgWallet({ userId: context.userId, label });

    const { data, error } = await supabaseAdmin
      .from("turnkey_wallets")
      .insert({
        user_id: context.userId,
        kind: "user",
        label,
        wallet_id: wallet.walletId,
        sub_organization_id: wallet.subOrganizationId,
        solana_address: wallet.solanaAddress,
        evm_address: wallet.evmAddress,
      })
      .select("id, kind, label, wallet_id, sub_organization_id, solana_address, evm_address, created_at")
      .single();
    if (error) throw new Error(error.message);
    return data as TurnkeyWalletRow;
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

/** Admin: list company treasury wallets. */
export const listCompanyTurnkeyWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase
      .from("turnkey_wallets")
      .select("id, kind, label, wallet_id, sub_organization_id, solana_address, evm_address, created_at")
      .eq("kind", "company")
      .order("created_at", { ascending: false });
    return (data ?? []) as TurnkeyWalletRow[];
  });

/** Admin: create a company treasury wallet in the parent organization. */
export const createCompanyTurnkeyWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { walletName: string }) => {
    const name = String(input?.walletName ?? "").trim();
    if (name.length < 2 || name.length > 60) throw new Error("Wallet name must be 2–60 characters");
    return { walletName: name };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { createCompanyWallet } = await import("./turnkey.server");
    const wallet = await createCompanyWallet(data.walletName);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("turnkey_wallets")
      .insert({
        user_id: null,
        kind: "company",
        label: data.walletName,
        wallet_id: wallet.walletId,
        sub_organization_id: null,
        solana_address: wallet.solanaAddress,
        evm_address: wallet.evmAddress,
      })
      .select("id, kind, label, wallet_id, sub_organization_id, solana_address, evm_address, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as TurnkeyWalletRow;
  });

/** Admin: sign a raw hex payload with a company wallet address (treasury ops). */
export const signWithCompanyWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { address: string; payload: string }) => {
    const address = String(input?.address ?? "").trim();
    const payload = String(input?.payload ?? "").trim();
    if (!address) throw new Error("Address is required");
    if (!/^(0x)?[0-9a-fA-F]{2,4096}$/.test(payload)) throw new Error("Payload must be hex");
    return { address, payload };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { signPayload } = await import("./turnkey.server");
    const res = await signPayload({
      signWith: data.address,
      payload: data.payload.startsWith("0x") ? data.payload.slice(2) : data.payload,
    });
    return { r: res.r, s: res.s, v: res.v };
  });
