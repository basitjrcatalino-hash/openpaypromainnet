import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "get_profile",
  title: "Get my profile",
  description:
    "Get the signed-in user's OpenPay Pro profile: display name, username, KYC status and account details.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input: Record<string, never>, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("profiles")
      .select("*")
      .eq("id", ctx.getUserId())
      .maybeSingle();

    if (error) {
      return { content: [{ type: "text" as const, text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data ?? {}) }],
      structuredContent: { profile: data ?? null },
    };
  },
});
