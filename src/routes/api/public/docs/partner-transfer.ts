import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function serveMarkdown(fileName: string, fallbackTitle: string) {
  try {
    const body = await readFile(path.join(process.cwd(), "docs", fileName), "utf8");
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response(`# ${fallbackTitle}\n\nDocs file not found on server.\n`, {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }
}

export const Route = createFileRoute("/api/public/docs/partner-transfer")({
  server: {
    handlers: {
      GET: async () => serveMarkdown("PARTNER_TRANSFER_API.md", "Partner Transfer API"),
    },
  },
});
