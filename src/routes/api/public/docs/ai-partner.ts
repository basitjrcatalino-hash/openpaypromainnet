import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Public raw markdown — AI Partner Integration Pack (Cursor / Lovable / Replit / Claude) */
export const Route = createFileRoute("/api/public/docs/ai-partner")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const body = await readFile(
            path.join(process.cwd(), "docs", "AI_PARTNER_INTEGRATION.md"),
            "utf8",
          );
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "text/markdown; charset=utf-8",
              "Cache-Control": "public, max-age=300",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch {
          return new Response("# AI Partner Integration\n\nDocs file not found on server.\n", {
            status: 404,
            headers: { "Content-Type": "text/markdown; charset=utf-8" },
          });
        }
      },
    },
  },
});
