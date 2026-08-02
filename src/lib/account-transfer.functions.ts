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
    spot: { ...zero },
    trading: { ...zero },
    p2p: { ...zero },
  };
}

function parseBucket(raw: unknown): Record<TransferAsset, number> {
  const zero = Object.fromEntries(TRANSFER_ASSETS.map((a) => [a, 0])) as Record<
    TransferAsset,
    number
  >;
  if (!raw || typeof raw !== "object") return zero;
  const obj = raw as Record<string, unknown>;
  for (const asset of TRANSFER_ASSETS) {
    zero[asset] = Number(obj[asset] ?? 0) || 0;
  }
  return zero;
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

    // Funding = wallet ledger columns.
    for (const asset of TRANSFER_ASSETS) {
      balances.funding[asset] = readFundingBalance(wallet as Record<string, unknown>, asset);
    }

    // Prefer RPC for Spot / Futures / P2P buckets when available.
    try {
      const { data: portfolio, error: pErr } = await (supabase as any).rpc("get_account_portfolio");
      if (!pErr && portfolio && typeof portfolio === "object") {
        const p = portfolio as Record<string, unknown>;
        const trading = parseBucket(p.trading);
        const p2p = parseBucket(p.p2p);
        const spot = parseBucket(p.spot);
        // Overlay funding from RPC only when it has positive balances (keeps wallet columns authoritative).
        const rpcFunding = parseBucket(p.funding);
        const rpcFundingTotal = TRANSFER_ASSETS.reduce((s, a) => s + (rpcFunding[a] ?? 0), 0);
        if (rpcFundingTotal > 0) {
          for (const asset of TRANSFER_ASSETS) {
            const rpc = rpcFunding[asset] ?? 0;
            const local = balances.funding[asset] ?? 0;
            balances.funding[asset] = Math.max(rpc, local);
          }
        }
        return {
          walletId: (p.wallet_id as string) ?? (wallet.id as string),
          balances: {
            funding: balances.funding,
            spot,
            trading,
            p2p,
          },
        };
      }
    } catch {
      /* fall through */
    }

    const { data: rows, error: bErr } = await supabase
      .from("wallet_account_balances")
      .select("account, asset, balance")
      .eq("wallet_id", wallet.id)
      .in("account", ["trading", "p2p", "spot"]);
    if (bErr) throw new Error(bErr.message);

    for (const row of rows ?? []) {
      const acct = String(row.account).toLowerCase() as AccountId;
      const asset = String(row.asset).toUpperCase() as TransferAsset;
      if (
        (acct === "trading" || acct === "p2p" || acct === "spot") &&
        TRANSFER_ASSETS.includes(asset)
      ) {
        balances[acct][asset] = Number(row.balance ?? 0) || 0;
      }
    }

    return { walletId: wallet.id as string, balances };
  });

export const internalAccountTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TransferSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
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

    // Email / push alert for account moves (Funding ↔ Trading ↔ P2P).
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const admin = supabaseAdmin as any;
      const { data: wallet } = await admin
        .from("wallets")
        .select("id")
        .eq("user_id", userId)
        .order("is_active", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (wallet?.id) {
        const { notifyWalletTransaction } = await import("./tx-alerts.server");
        await notifyWalletTransaction(admin, wallet.id, {
          id: `xfer:${wallet.id}:${data.from}:${data.to}:${data.asset}:${data.amount}:${Date.now()}`,
          type: "send",
          token_symbol: data.asset,
          amount: data.amount,
          counterparty: data.to,
          memo: `Transferred ${data.amount} ${data.asset} · ${data.from} → ${data.to}`,
          status: "confirmed",
          wallet_id: wallet.id,
        });
      }
    } catch (err) {
      console.warn("[account-transfer] tx alert failed", err);
    }

    return result as { ok: boolean; from: string; to: string; asset: string; amount: number };
  });

export type AccountTransferEvent = {
  id: string;
  wallet_id: string;
  user_id: string;
  from_account: AccountId;
  to_account: AccountId;
  asset: string;
  amount: number;
  created_at: string;
};

const HistorySchema = z.object({
  account: z.enum(ACCOUNT_IDS).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

/** Dedicated transfer history (Funding ↔ Trading ↔ P2P). Falls back to transactions memo. */
export const listAccountTransfers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => HistorySchema.parse(d ?? {}))
  .handler(async ({ context, data }): Promise<AccountTransferEvent[]> => {
    const { supabase, userId } = context;
    const limit = data.limit ?? 50;
    const account = data.account;

    const { data: rows, error } = await (supabase as any)
      .from("account_transfer_events")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit * 2);

    if (!error && rows) {
      const mapped = (rows as any[]).map((r) => ({
        id: r.id as string,
        wallet_id: r.wallet_id as string,
        user_id: r.user_id as string,
        from_account: String(r.from_account).toLowerCase() as AccountId,
        to_account: String(r.to_account).toLowerCase() as AccountId,
        asset: String(r.asset).toUpperCase(),
        amount: Number(r.amount ?? 0),
        created_at: r.created_at as string,
      }));
      if (!account) return mapped.slice(0, limit);
      return mapped
        .filter((e) => e.from_account === account || e.to_account === account)
        .slice(0, limit);
    }

    // Fallback: parse transactions memo acct_xfer:from→to
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", userId)
      .order("is_active", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!wallet) return [];

    const { data: txs } = await supabase
      .from("transactions")
      .select("id, wallet_id, token_symbol, amount, memo, counterparty, type, created_at")
      .eq("wallet_id", wallet.id)
      .ilike("memo", "acct_xfer:%")
      .eq("type", "send")
      .order("created_at", { ascending: false })
      .limit(limit * 2);

    const out: AccountTransferEvent[] = [];
    for (const tx of txs ?? []) {
      const memo = String(tx.memo ?? "");
      const m = memo.match(/acct_xfer:([a-z]+)→([a-z]+)/i);
      if (!m) continue;
      const from_account = m[1].toLowerCase() as AccountId;
      const to_account = m[2].toLowerCase() as AccountId;
      if (account && from_account !== account && to_account !== account) continue;
      out.push({
        id: tx.id,
        wallet_id: tx.wallet_id,
        user_id: userId,
        from_account,
        to_account,
        asset: String(tx.token_symbol ?? "").toUpperCase(),
        amount: Number(tx.amount ?? 0),
        created_at: tx.created_at,
      });
      if (out.length >= limit) break;
    }
    return out;
  });
