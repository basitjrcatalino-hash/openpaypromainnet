import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Public — anyone can look up an OpenPay recipient before sending.
export const resolveOpenPayAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ identifier: z.string().trim().min(2).max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { openpayPro } = await import("./openpay-pro.server");
    try {
      const acct = await openpayPro.resolveAccount(data.identifier);
      return { ok: true as const, account: acct };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });

export const getOpenPayPartnerInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { openpayPro } = await import("./openpay-pro.server");
    try {
      const me = await openpayPro.me();
      return { ok: true as const, account: me };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });

// Create a hosted checkout charge so the user can pay from their own OpenPay
// balance and top up this wallet.
export const createOpenPayTopupCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        amount: z.number().positive().max(50_000),
        origin: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { openpayPro } = await import("./openpay-pro.server");
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const reference = `topup_${context.userId}_${Date.now()}`;
    const charge = await openpayPro.createCharge({
      amount: data.amount,
      currency: "OUSD",
      description: `OUSD top-up for ${context.userId.slice(0, 8)}`,
      reference,
      success_url: `${data.origin}/topup?openpay_charge=${reference}`,
      cancel_url: `${data.origin}/topup?openpay_cancel=1`,
    });

    void supabaseAdmin;


    return { charge };
  });

// Poll after the buyer returns from OpenPay hosted checkout. If paid and not
// yet credited, credit the wallet exactly once.
export const settleOpenPayCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ chargeId: z.string().min(4).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { openpayPro } = await import("./openpay-pro.server");
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { supabase, userId } = context;

    const charge = await openpayPro.getCharge(data.chargeId);
    if (charge.status !== "paid") {
      return { status: charge.status, credited: false };
    }

    // Idempotency: use counterparty tag to guarantee single credit.
    const counterparty = `openpay:${charge.id}`;
    const { data: existing } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("counterparty", counterparty)
      .limit(1)
      .maybeSingle();
    if (existing) return { status: "paid", credited: true, already: true };

    const { data: wallet, error: wErr } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (wErr || !wallet) throw new Error("Active wallet not found");

    const amount = Number(charge.amount);
    const newBal = Number(wallet.ousd_balance ?? 0) + amount;
    const { error: uErr } = await supabase
      .from("wallets")
      .update({ ousd_balance: newBal })
      .eq("id", wallet.id);
    if (uErr) throw new Error(uErr.message);

    await supabase.from("transactions").insert({
      wallet_id: wallet.id,
      type: "buy",
      token_symbol: "OUSD",
      counterparty,
      amount,
      usd_value: amount,
      memo: `OpenPay checkout ${charge.id}`,
    });

    return { status: "paid", credited: true, balance: newBal };
  });

// Push OpenPay balance from the partner wallet to any OpenPay user
// (@username, OP account number, or email). Debits this wallet's OUSD
// balance in the same transaction so the ledger stays consistent.
export const sendViaOpenPay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        to: z.string().trim().min(2).max(120),
        amount: z.number().positive().max(1_000_000),
        note: z.string().max(140).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { openpayPro } = await import("./openpay-pro.server");
    const { supabase, userId } = context;

    const { data: wallet, error: wErr } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (wErr || !wallet) throw new Error("Active wallet not found");
    const cur = Number(wallet.ousd_balance ?? 0);
    if (cur < data.amount) throw new Error("Insufficient OUSD balance");

    const idem = `${wallet.id}-${Date.now()}`;
    const result = await openpayPro.sendTransfer(
      { to: data.to, amount: data.amount, note: data.note ?? undefined },
      idem,
    );

    const newBal = cur - data.amount;
    await supabase
      .from("wallets")
      .update({ ousd_balance: newBal })
      .eq("id", wallet.id);

    await supabase.from("transactions").insert({
      wallet_id: wallet.id,
      type: "send",
      token_symbol: "OUSD",
      counterparty: `openpay:${data.to}`,
      amount: data.amount,
      usd_value: data.amount,
      memo: data.note ?? `OpenPay transfer`,
    });

    return { ok: true, balance: newBal, transfer: result };
  });
