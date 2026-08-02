import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Public raw markdown for exchange / network OUSD integrators. */
export const Route = createFileRoute("/api/public/docs/exchange")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const root = process.cwd();
          const body = await readFile(path.join(root, "docs", "EXCHANGE_INTEGRATION.md"), "utf8");
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "text/markdown; charset=utf-8",
              "Cache-Control": "public, max-age=300",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch {
          return new Response("# Exchange Integration\n\nDocs file not found on server.\n", {
            status: 404,
            headers: { "Content-Type": "text/markdown; charset=utf-8" },
          });
        }
      },
    },
  },
});
