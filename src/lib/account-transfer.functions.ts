/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ACCOUNT_IDS,
  TRANSFER_ASSETS,
  fundingBalanceColumn,
  readFundingBalance,
  type AccountId,
  type TransferAsset,
} from "@/lib/account-transfer";

const TransferSchema = z.object({
  from: z.enum(ACCOUNT_IDS),
  to: z.enum(ACCOUNT_IDS),
  asset: z.enum(TRANSFER_ASSETS),
  amount: z.number().positive().max(1e15),
});

export type AccountBalances = Record<AccountId, Record<TransferAsset, number>>;

function emptyBalances(): AccountBalances {
  const zero = Object.fromEntries(TRANSFER_ASSETS.map((a) => [a, 0])) as Record<
    TransferAsset,
    number
  >;
  return {
    funding: { ...zero },
    trading: { ...zero },
    p2p: { ...zero },
  };
}

export const getAccountBalances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ walletId: string | null; balances: AccountBalances }> => {
    const { supabase, userId } = context;
    const balances = emptyBalances();

    const { data: wallet, error: wErr } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!wallet) return { walletId: null, balances };

    for (const asset of TRANSFER_ASSETS) {
      balances.funding[asset] = readFundingBalance(wallet as Record<string, unknown>, asset);
    }

    const { data: rows, error: bErr } = await supabase
      .from("wallet_account_balances")
      .select("account, asset, balance")
      .eq("wallet_id", wallet.id)
      .in("account", ["trading", "p2p"]);
    if (bErr) throw new Error(bErr.message);

    for (const row of rows ?? []) {
      const acct = String(row.account).toLowerCase() as AccountId;
      const asset = String(row.asset).toUpperCase() as TransferAsset;
      if ((acct === "trading" || acct === "p2p") && TRANSFER_ASSETS.includes(asset)) {
        balances[acct][asset] = Number(row.balance ?? 0) || 0;
      }
    }

    return { walletId: wallet.id as string, balances };
  });

export const internalAccountTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TransferSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    if (data.from === data.to) throw new Error("From and To accounts must differ");

    const col = fundingBalanceColumn(data.asset);
    if (!col) throw new Error(`Unsupported asset ${data.asset}`);

    const { data: result, error } = await supabase.rpc("internal_account_transfer", {
      _from: data.from,
      _to: data.to,
      _asset: data.asset,
      _amount: data.amount,
    });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; from: string; to: string; asset: string; amount: number };
  });
