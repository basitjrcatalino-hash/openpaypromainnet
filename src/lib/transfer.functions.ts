import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SendSchema = z.object({
  to: z.string().trim().min(4).max(120),
  amount: z.number().positive().max(1e15),
  asset: z.enum(["OUSD", "PI"]),
  memo: z.string().max(140).optional().nullable(),
});

export const sendAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { to, amount, asset, memo } = data;

    const { data: wallet, error: wErr } = await supabase
      .from("wallets").select("*").eq("user_id", userId).limit(1).maybeSingle();
    if (wErr || !wallet) throw new Error("Active wallet not found");

    const curO = Number(wallet.ousd_balance ?? 0);
    const curP = Number(wallet.pi_balance ?? 0);
    const cur = asset === "OUSD" ? curO : curP;
    if (cur < amount) throw new Error(`Insufficient ${asset} balance`);

    const senderPatch = asset === "OUSD" ? { ousd_balance: curO - amount } : { pi_balance: curP - amount };
    const { error: updErr } = await supabase
      .from("wallets").update(senderPatch).eq("id", wallet.id);
    if (updErr) throw updErr;

    const usd = asset === "OUSD" ? amount : amount * 32.5;

    // Try to credit recipient if address belongs to another wallet (uses admin client)
    let credited = false;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rcpt } = await supabaseAdmin
        .from("wallets").select("*").eq("address", to).maybeSingle();
      if (rcpt) {
        const rcur = Number((rcpt as any)[balKey] ?? 0);
        await supabaseAdmin.from("wallets").update({ [balKey]: rcur + amount }).eq("id", rcpt.id);
        await supabaseAdmin.from("transactions").insert({
          wallet_id: rcpt.id, type: "receive", token_symbol: asset,
          counterparty: wallet.address, amount, usd_value: usd, memo: memo ?? null,
        });
        credited = true;
      }
    } catch (e) {
      console.error("recipient credit failed", e);
    }

    await supabase.from("transactions").insert({
      wallet_id: wallet.id, type: "send", token_symbol: asset,
      counterparty: to, amount, usd_value: usd, memo: memo ?? null,
    });

    return { ok: true, credited };
  });

const TopUpSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  method: z.enum(["openpay", "card", "bank"]),
  reference: z.string().max(80).optional().nullable(),
});

export const topUpOUSD = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TopUpSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { amount, method, reference } = data;

    const { data: wallet, error } = await supabase
      .from("wallets").select("*").eq("user_id", userId).limit(1).maybeSingle();
    if (error || !wallet) throw new Error("Active wallet not found");

    const nb = Number(wallet.ousd_balance ?? 0) + amount;
    const { error: uErr } = await supabase
      .from("wallets").update({ ousd_balance: nb }).eq("id", wallet.id);
    if (uErr) throw uErr;

    await supabase.from("transactions").insert({
      wallet_id: wallet.id, type: "topup", token_symbol: "OUSD",
      counterparty: `${method}:${reference ?? "openpay"}`, amount, usd_value: amount,
      memo: `Top-up via ${method}`,
    });

    return { ok: true, balance: nb };
  });
