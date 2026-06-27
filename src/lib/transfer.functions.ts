import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SendSchema = z.object({
  to: z.string().trim().min(2).max(120),
  amount: z.number().positive().max(1e15),
  asset: z.enum(["OUSD", "PI"]),
  memo: z.string().max(140).optional().nullable(),
});

async function resolveRecipientAddress(toRaw: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const to = toRaw.trim().replace(/^@/, "");

  // 1) Treat as wallet address first
  const { data: byAddr } = await supabaseAdmin
    .from("wallets").select("address").eq("address", to).maybeSingle();
  if (byAddr?.address) return byAddr.address;

  // 2) Look up profile by username or pi_username (case-insensitive)
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .or(`username.ilike.${to},pi_username.ilike.${to},display_name.ilike.${to}`)
    .limit(1)
    .maybeSingle();
  if (!prof?.id) return null;

  const { data: w } = await supabaseAdmin
    .from("wallets")
    .select("address")
    .eq("user_id", prof.id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return w?.address ?? null;
}

export const sendAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { to: toInput, amount, asset, memo } = data;

    const toAddress = (await resolveRecipientAddress(toInput)) ?? toInput;

    const { data: wallet, error: wErr } = await supabase
      .from("wallets").select("*").eq("user_id", userId).limit(1).maybeSingle();
    if (wErr || !wallet) throw new Error("Active wallet not found");
    if (toAddress === wallet.address) throw new Error("Cannot send to your own address");

    const curO = Number(wallet.ousd_balance ?? 0);
    const curP = Number(wallet.pi_balance ?? 0);
    const cur = asset === "OUSD" ? curO : curP;
    if (cur < amount) throw new Error(`Insufficient ${asset} balance`);

    const senderPatch = asset === "OUSD" ? { ousd_balance: curO - amount } : { pi_balance: curP - amount };
    const { error: updErr } = await supabase
      .from("wallets").update(senderPatch).eq("id", wallet.id);
    if (updErr) throw updErr;

    const usd = asset === "OUSD" ? amount : amount * 32.5;

    let credited = false;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rcpt } = await supabaseAdmin
        .from("wallets").select("*").eq("address", toAddress).maybeSingle();
      if (rcpt) {
        const rO = Number(rcpt.ousd_balance ?? 0);
        const rP = Number(rcpt.pi_balance ?? 0);
        const rcptPatch = asset === "OUSD" ? { ousd_balance: rO + amount } : { pi_balance: rP + amount };
        await supabaseAdmin.from("wallets").update(rcptPatch).eq("id", rcpt.id);
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
      counterparty: toAddress, amount, usd_value: usd, memo: memo ?? null,
    });

    return { ok: true, credited, resolvedTo: toAddress };
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
      wallet_id: wallet.id, type: "buy", token_symbol: "OUSD",
      counterparty: `${method}:${reference ?? "openpay"}`, amount, usd_value: amount,
      memo: `Top-up via ${method}`,
    });

    return { ok: true, balance: nb };
  });
