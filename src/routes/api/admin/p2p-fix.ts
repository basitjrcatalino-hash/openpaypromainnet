import { createFileRoute } from "@tanstack/react-router";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * One-shot P2P escrow repair (gen_random_bytes → gen_random_uuid).
 * POST with header `x-webhook-secret: ${TX_WEBHOOK_SECRET}`.
 * Safe to call repeatedly (CREATE OR REPLACE).
 */
export const Route = createFileRoute("/api/admin/p2p-fix")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const secret = process.env.TX_WEBHOOK_SECRET?.trim();
          const hdr = request.headers.get("x-webhook-secret") || "";
          if (!secret) {
            return Response.json({ error: "Webhook not configured" }, { status: 503 });
          }
          if (hdr !== secret) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(
            /\/$/,
            "",
          );
          const serviceKey =
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
            process.env.SUPABASE_SECRET_KEY ||
            process.env.SUPABASE_SERVICE_KEY ||
            "";
          if (!url || !serviceKey) {
            return Response.json({ error: "Supabase admin env missing" }, { status: 503 });
          }

          const sqlPath = join(
            process.cwd(),
            "supabase/migrations/20260801110000_p2p_fix_escrow_refs.sql",
          );
          let sql: string;
          try {
            sql = readFileSync(sqlPath, "utf8");
          } catch {
            return Response.json({ error: "Migration file not found on server" }, { status: 500 });
          }

          const projectId =
            process.env.SUPABASE_PROJECT_ID || process.env.VITE_SUPABASE_PROJECT_ID || "";
          const dbUrl =
            process.env.DATABASE_URL ||
            process.env.POSTGRES_URL ||
            process.env.POSTGRES_PRISMA_URL ||
            process.env.DIRECT_URL ||
            "";

          // 1) Direct Postgres when a connection string is available (Lovable/Vercel).
          if (dbUrl) {
            try {
              const { default: postgres } = await import("postgres");
              const sqlClient = postgres(dbUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
              try {
                await sqlClient.unsafe(sql);
                return Response.json({ ok: true, via: "database_url" });
              } finally {
                await sqlClient.end({ timeout: 5 });
              }
            } catch (e) {
              // Fall through to HTTP endpoints; postgres package may be unavailable.
              console.warn("[p2p-fix] database_url path failed:", (e as Error).message);
            }
          }

          // 2) HTTP SQL endpoints (pg-meta / Management API).
          const attempts: Array<{ endpoint: string; headers: Record<string, string>; body: unknown }> =
            [
              {
                endpoint: `${url}/pg/query`,
                headers: {
                  "Content-Type": "application/json",
                  apikey: serviceKey,
                  Authorization: `Bearer ${serviceKey}`,
                },
                body: { query: sql },
              },
            ];

          if (process.env.SUPABASE_ACCESS_TOKEN && projectId) {
            attempts.push({
              endpoint: `https://api.supabase.com/v1/projects/${projectId}/database/query`,
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
              },
              body: { query: sql },
            });
          }

          const errors: string[] = [];
          for (const attempt of attempts) {
            const res = await fetch(attempt.endpoint, {
              method: "POST",
              headers: attempt.headers,
              body: JSON.stringify(attempt.body),
            });
            const text = await res.text();
            if (res.ok) {
              return Response.json({
                ok: true,
                via: attempt.endpoint,
                detail: text.slice(0, 1000),
              });
            }
            errors.push(`${attempt.endpoint} → ${res.status}: ${text.slice(0, 300)}`);
          }

          return Response.json({ error: "All SQL endpoints failed", errors }, { status: 502 });
        } catch (err) {
          console.error("[p2p-fix]", err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
