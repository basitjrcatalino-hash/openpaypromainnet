import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Public raw markdown — Pro Connect Auth & Pay */
export const Route = createFileRoute("/api/public/docs/integrations")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const body = await readFile(
            path.join(process.cwd(), "docs", "PRO_CONNECT_INTEGRATION.md"),
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
          return new Response("# Pro Connect Integration\n\nDocs file not found on server.\n", {
            status: 404,
            headers: { "Content-Type": "text/markdown; charset=utf-8" },
          });
        }
      },
    },
  },
});
