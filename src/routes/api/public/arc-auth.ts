import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("challenge"), address: z.string().regex(/^0x[0-9a-fA-F]{40}$/), purpose: z.enum(["link", "login"]), allowSignup: z.boolean().default(false) }),
  z.object({ action: z.literal("verify"), id: z.string().uuid(), signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(4096), purpose: z.enum(["link", "login"]) }),
]);

export const Route = createFileRoute("/api/public/arc-auth")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const origin = request.headers.get("origin");
      const allowed = new Set([new URL(request.url).origin, "https://openpaypro.space", "https://www.openpaypro.space", "https://openpaypromainnet.lovable.app"]);
      if (!origin || !allowed.has(origin)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
      const input = inputSchema.parse(await request.json());
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const flags = await supabaseAdmin.from("auth_methods").select("enabled").eq("method_key", "arc").maybeSingle();
      if (flags.error || flags.data?.enabled !== true) return Response.json({ error: "Arc wallet access is temporarily unavailable." }, { status: 503 });
      let userId: string | null = null;
      const authorization = request.headers.get("authorization");
      if (authorization) {
        if (!authorization.startsWith("Bearer ")) return Response.json({ error: "Invalid session." }, { status: 401 });
        const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7));
        if (error || !data.user) return Response.json({ error: "Invalid session." }, { status: 401 });
        userId = data.user.id;
      }
      if (input.purpose === "link" && !userId) return Response.json({ error: "Sign in to your existing account before linking a wallet." }, { status: 401 });
      if (input.action === "challenge") {
        const address = input.address.toLowerCase();
        const { getAddress } = await import("viem");
        const now = new Date();
        const expires = new Date(now.getTime() + 5 * 60_000);
        const nonce = crypto.randomUUID().replaceAll("-", "");
        const message = `${new URL(origin).host} wants you to sign in with your Ethereum account:\n${getAddress(address)}\n\n${input.purpose === "link" ? "Link this Arc wallet to your existing OpenPay Pro account." : input.allowSignup ? "Create an OpenPay Pro wallet account, or sign in if this wallet is already linked. No transaction or funds approval." : "Sign in to your existing OpenPay Pro account with your linked Arc wallet."}\n\nURI: ${origin}/auth\nVersion: 1\nChain ID: 5042\nNonce: ${nonce}\nIssued At: ${now.toISOString()}\nExpiration Time: ${expires.toISOString()}`;
        const { data, error } = await supabaseAdmin.from("arc_auth_challenges").insert({ address, user_id: userId, purpose: input.purpose, allow_signup: input.purpose === "login" && input.allowSignup, message, expires_at: expires.toISOString() }).select("id, message").single();
        if (error) throw error;
        return Response.json(data, { headers: { "Cache-Control": "no-store" } });
      }
      const { data: challenge, error } = await supabaseAdmin.from("arc_auth_challenges").select("*").eq("id", input.id).is("consumed_at", null).single();
      if (error || !challenge || challenge.purpose !== input.purpose || Date.parse(challenge.expires_at) <= Date.now() || !challenge.message.startsWith(`${new URL(origin).host} wants you`) || (input.purpose === "link" && challenge.user_id !== userId)) return Response.json({ error: "Wallet challenge is invalid or expired." }, { status: 401 });
      const { createPublicClient, http, getAddress } = await import("viem");
      const { arcMainnet } = await import("@/lib/arc-network");
      const client = createPublicClient({ chain: arcMainnet, transport: http() });
      const valid = await client.verifyMessage({ address: getAddress(challenge.address), message: challenge.message, signature: input.signature as `0x${string}` });
      if (!valid) return Response.json({ error: "Wallet signature is invalid." }, { status: 401 });
      const consumed = await supabaseAdmin.from("arc_auth_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", input.id).is("consumed_at", null).gt("expires_at", new Date().toISOString()).select("id");
      if (consumed.error || consumed.data?.length !== 1) return Response.json({ error: "Challenge already used or expired." }, { status: 401 });
      if (input.purpose === "link") {
        if (!userId) return Response.json({ error: "Sign-in required." }, { status: 401 });
        const existing = await supabaseAdmin.from("arc_wallet_links").select("user_id").eq("address", challenge.address).maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data && existing.data.user_id !== userId) return Response.json({ error: "This wallet is already linked to another account." }, { status: 409 });
        if (!existing.data) {
          const inserted = await supabaseAdmin.from("arc_wallet_links").insert({ address: challenge.address, user_id: userId });
          if (inserted.error) return Response.json({ error: "Wallet could not be linked. It may already belong to another account." }, { status: 409 });
        }
        return Response.json({ linked: true }, { headers: { "Cache-Control": "no-store" } });
      }
      const { resolveArcAccount } = await import("@/lib/arc-account.server");
      const accountId = await resolveArcAccount(supabaseAdmin, challenge.address, challenge.allow_signup);
      const account = await supabaseAdmin.auth.admin.getUserById(accountId);
      const email = account.data.user?.email;
      if (account.error || !email) return Response.json({ error: "Linked account is unavailable." }, { status: 403 });
      const session = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
      if (session.error) throw session.error;
      return Response.json({ tokenHash: session.data.properties.hashed_token }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return Response.json({ error: error instanceof z.ZodError ? "Invalid wallet request." : "Wallet verification is unavailable. Please try again." }, { status: 400 });
    }
  } } },
});