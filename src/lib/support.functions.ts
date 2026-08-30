import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUPPORT_SYSTEM_PROMPT = `You are OpenPay AI Support, the first-line support agent for OpenPay Pro Wallet.

Be warm, concise and practical. Use short paragraphs and bullet points. You are talking to a signed-in customer inside a support ticket.

You can help with: wallets and balances, Top Up (OpenPay QR Pay, Pro charges, admin vouchers), Send/Receive (wallet address, @username, Pi username), Swap/OpenDex, Deposits (multi-chain deposit gateway), Withdrawals, P2P marketplace and escrow, Trade (spot, perpetual, exchange mode), OpenToken launchpad, NFTs, the public Ledger, KYC via Pi Verify, security (PIN, biometric unlock, recovery phrase), Agent Connect / MCP, and Developer APIs.

Rules:
- Never ask for a password, PIN, recovery phrase, private key or API key.
- You cannot see balances or move funds. For account-specific issues, explain what the customer should check and tell them a human agent will pick up the ticket.
- If the issue involves a missing deposit, failed payment, frozen escrow, refund, or account access, gather the useful details (amount, asset, network, transaction hash, time) and say a human agent has been notified.
- Keep answers under ~150 words unless steps are needed.`;

async function isAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  return Boolean(data);
}

/** Create a ticket (or return the customer's existing open ticket). */
export const startSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string().trim().min(2).max(160).optional(),
        category: z
          .enum(["general", "deposit", "withdrawal", "payment", "p2p", "trade", "kyc", "security", "bug"])
          .default("general"),
        openpay_account: z.string().trim().max(80).nullish(),
        reuse_open: z.boolean().default(true),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.reuse_open) {
      const { data: existing } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("user_id", userId)
        .in("status", ["open", "pending"])
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.id) return { ticketId: existing.id as string, created: false };
    }

    const [{ data: profile }, { data: wallet }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, username, pi_username, kyc_status")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("wallets").select("address").eq("user_id", userId).limit(1).maybeSingle(),
    ]);

    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: userId,
        subject: data.subject ?? "Support request",
        category: data.category,
        display_name: profile?.display_name ?? null,
        username: profile?.username ?? profile?.pi_username ?? null,
        openpay_account: data.openpay_account ?? null,
        wallet_address: wallet?.address ?? null,
        kyc_status: profile?.kyc_status ?? "not_started",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { ticketId: ticket.id as string, created: true };
  });

export const listMySupportTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", context.userId)
      .order("last_message_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getSupportThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: ticket, error: tErr }, { data: messages, error: mErr }] = await Promise.all([
      supabase.from("support_tickets").select("*").eq("id", data.ticketId).maybeSingle(),
      supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", data.ticketId)
        .order("created_at", { ascending: true })
        .limit(500),
    ]);
    if (tErr) throw new Error(tErr.message);
    if (mErr) throw new Error(mErr.message);
    if (!ticket) throw new Error("Ticket not found");
    return { ticket, messages: messages ?? [] };
  });

/** Customer sends a message; optionally the AI agent replies. */
export const sendSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        body: z.string().trim().max(4000).default(""),
        image_url: z.string().url().max(2000).nullish(),
      })
      .refine((v) => v.body.length > 0 || Boolean(v.image_url), {
        message: "Message or image required",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("id, user_id, ai_enabled, status")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticket) throw new Error("Ticket not found");

    const { error } = await supabase.from("support_messages").insert({
      ticket_id: data.ticketId,
      sender_id: userId,
      role: "user",
      body: data.body,
      image_url: data.image_url ?? null,
    });
    if (error) throw new Error(error.message);

    if (ticket.status === "resolved" || ticket.status === "closed") {
      await supabase.from("support_tickets").update({ status: "open" }).eq("id", data.ticketId);
    }

    if (!ticket.ai_enabled) return { aiReplied: false };

    // Auto-response from OpenPay AI
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { aiReplied: false };

    const { data: history } = await supabase
      .from("support_messages")
      .select("role, body, image_url")
      .eq("ticket_id", data.ticketId)
      .order("created_at", { ascending: true })
      .limit(30);

    try {
      const { generateText } = await import("ai");
      const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
      const gateway = createLovableAiGatewayProvider(key);

      const result = await generateText({
        model: gateway("google/gemini-3.6-flash"),
        system: SUPPORT_SYSTEM_PROMPT,
        messages: (history ?? []).map((m: { role: string; body: string; image_url: string | null }) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.image_url ? `${m.body}\n\n[customer attached a screenshot]` : m.body,
        })),
      });

      const text = (result.text ?? "").trim();
      if (!text) return { aiReplied: false };

      // RLS only lets a customer insert their own role='user' rows, so the
      // assistant reply is written with the privileged server client.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: aiErr } = await supabaseAdmin.from("support_messages").insert({
        ticket_id: data.ticketId,
        sender_id: null,
        role: "ai",
        body: text,
      });
      if (aiErr) return { aiReplied: false };
      return { aiReplied: true };
    } catch {
      return { aiReplied: false };
    }
  });

/* ---------------------------- admin ---------------------------- */

export const adminListSupportTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.enum(["all", "open", "pending", "resolved", "closed"]).default("all"),
        search: z.string().trim().max(120).default(""),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");

    let query = context.supabase
      .from("support_tickets")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(200);

    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.search) {
      const s = `%${data.search.replace(/[%,]/g, "")}%`;
      query = query.or(
        `username.ilike.${s},display_name.ilike.${s},openpay_account.ilike.${s},wallet_address.ilike.${s},subject.ilike.${s}`,
      );
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminReplySupport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
        image_url: z.string().url().max(2000).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const { error } = await context.supabase.from("support_messages").insert({
      ticket_id: data.ticketId,
      sender_id: context.userId,
      role: "admin",
      body: data.body,
      image_url: data.image_url ?? null,
    });
    if (error) throw new Error(error.message);
    // A human took over: stop the bot for this ticket.
    await context.supabase
      .from("support_tickets")
      .update({ ai_enabled: false, status: "pending" })
      .eq("id", data.ticketId);
    return { ok: true };
  });

export const adminUpdateSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        ai_enabled: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const patch: { status?: string; priority?: string; ai_enabled?: boolean } = {};
    if (data.status) patch.status = data.status;
    if (data.priority) patch.priority = data.priority;
    if (typeof data.ai_enabled === "boolean") patch.ai_enabled = data.ai_enabled;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await context.supabase
      .from("support_tickets")
      .update(patch)
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const isSupportAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ admin: await isAdmin(context) }));
