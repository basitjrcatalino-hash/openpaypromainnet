import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_wallets",
  title: "List my wallets",
  description:
    "List the signed-in user's OpenPay Pro wallets with their addresses and per-asset balances (OUSD, PI, SOL, USDC, and others).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input: Record<string, never>, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("wallets")
      .select("*")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: true });

    if (error) {
      return { content: [{ type: "text" as const, text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data ?? []) }],
      structuredContent: { wallets: data ?? [] },
    };
  },
});
