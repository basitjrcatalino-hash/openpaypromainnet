import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Public OpenAPI 3.1 — Partner Transfer + Pro inbound/ledger */
export const Route = createFileRoute("/api/public/docs/openapi")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const body = await readFile(
            path.join(process.cwd(), "docs", "openapi-partner.yaml"),
            "utf8",
          );
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "application/yaml; charset=utf-8",
              "Cache-Control": "public, max-age=300",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch {
          return new Response("openapi: 3.1.0\ninfo:\n  title: missing\n", {
            status: 404,
            headers: { "Content-Type": "application/yaml; charset=utf-8" },
          });
        }
      },
    },
  },
});
