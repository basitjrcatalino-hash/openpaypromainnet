import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const Route = createFileRoute("/api/public/docs/ledger")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const body = await readFile(path.join(process.cwd(), "docs", "LEDGER_API.md"), "utf8");
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "text/markdown; charset=utf-8",
              "Cache-Control": "public, max-age=300",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch {
          return new Response("# Public Ledger API\n\nDocs file not found on server.\n", {
            status: 404,
            headers: { "Content-Type": "text/markdown; charset=utf-8" },
          });
        }
      },
    },
  },
});
