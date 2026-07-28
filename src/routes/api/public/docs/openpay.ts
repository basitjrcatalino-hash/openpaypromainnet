import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Public raw markdown for third-party integrators (integration + Pro auth). */
export const Route = createFileRoute("/api/public/docs/openpay")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const root = process.cwd();
          const integration = await readFile(
            path.join(root, "docs", "OPENPAY_INTEGRATION.md"),
            "utf8",
          );
          let auth = "";
          try {
            auth = await readFile(path.join(root, "docs", "OPENPAY_PRO_AUTH.md"), "utf8");
          } catch {
            /* optional */
          }
          const body = auth ? `${integration.trim()}\n\n---\n\n${auth.trim()}\n` : integration;
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "text/markdown; charset=utf-8",
              "Cache-Control": "public, max-age=300",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch {
          return new Response("# OpenPay Integration\n\nDocs file not found on server.\n", {
            status: 404,
            headers: { "Content-Type": "text/markdown; charset=utf-8" },
          });
        }
      },
    },
  },
});
