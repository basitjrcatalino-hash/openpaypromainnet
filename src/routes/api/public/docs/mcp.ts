import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Public raw markdown — Agent Connect · MCP */
export const Route = createFileRoute("/api/public/docs/mcp")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const file = path.join(process.cwd(), "docs", "MCP_AGENT_CONNECT.md");
          const body = await readFile(file, "utf8");
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "text/markdown; charset=utf-8",
              "Cache-Control": "public, max-age=300",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch {
          return new Response("# Agent Connect · MCP\n\nDocs file not found on server.\n", {
            status: 404,
            headers: { "Content-Type": "text/markdown; charset=utf-8" },
          });
        }
      },
    },
  },
});
