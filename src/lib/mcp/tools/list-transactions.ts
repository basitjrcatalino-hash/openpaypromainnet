import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_transactions",
  title: "List my transactions",
  description:
    "List recent transactions across the signed-in user's OpenPay Pro wallets, newest first.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("How many transactions to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }: { limit?: number }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
    }
    const client = supabaseForUser(ctx);
    const { data: wallets, error: walletErr } = await client
      .from("wallets")
      .select("id")
      .eq("user_id", ctx.getUserId());

    if (walletErr) {
      return { content: [{ type: "text" as const, text: walletErr.message }], isError: true };
    }
    const walletIds = (wallets ?? []).map((w: { id: string }) => w.id);
    if (walletIds.length === 0) {
      return {
        content: [{ type: "text" as const, text: "[]" }],
        structuredContent: { transactions: [] },
      };
    }

    const { data, error } = await client
      .from("transactions")
      .select("*")
      .in("wallet_id", walletIds)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);

    if (error) {
      return { content: [{ type: "text" as const, text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data ?? []) }],
      structuredContent: { transactions: data ?? [] },
    };
  },
});
