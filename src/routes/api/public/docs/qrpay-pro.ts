import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Public raw markdown — OpenPay QR Pay → OpenPay Pro integration */
export const Route = createFileRoute("/api/public/docs/qrpay-pro")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const body = await readFile(
            path.join(process.cwd(), "docs", "OPENPAY_QRPAY_PRO.md"),
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
          return new Response("# OpenPay QR Pay → Pro\n\nDocs file not found.\n", {
            status: 404,
            headers: { "Content-Type": "text/markdown; charset=utf-8" },
          });
        }
      },
    },
  },
});
