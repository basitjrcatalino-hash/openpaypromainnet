import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_ledger_entries",
  title: "List ledger entries",
  description:
    "List entries from the OpenPay Pro public ledger, newest first. Optionally filter by asset symbol.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("How many ledger entries to return (default 20, max 100)."),
    asset: z.string().optional().describe("Filter by asset/token symbol, e.g. OUSD or PI."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, asset }: { limit?: number; asset?: string }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
    }
    let query = supabaseForUser(ctx)
      .from("ledger_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);

    if (asset) query = query.eq("asset", asset.toUpperCase());

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text" as const, text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data ?? []) }],
      structuredContent: { entries: data ?? [] },
    };
  },
});
