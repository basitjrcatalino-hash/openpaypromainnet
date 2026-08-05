import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { WIKI_GUIDES } from "@/lib/wiki-guides";
import { BLOG_POSTS } from "@/lib/blog-posts";

const BASE_URL = "https://openpaypro.space";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/authpi", changefreq: "weekly", priority: "0.9" },
          { path: "/auth", changefreq: "weekly", priority: "0.85" },
          { path: "/about", changefreq: "monthly", priority: "0.85" },
          { path: "/funding", changefreq: "monthly", priority: "0.9" },
          { path: "/openusd", changefreq: "monthly", priority: "0.85" },
          { path: "/pitch", changefreq: "monthly", priority: "0.9" },
          { path: "/website", changefreq: "weekly", priority: "0.95" },
          { path: "/wiki", changefreq: "weekly", priority: "0.85" },
          { path: "/blog", changefreq: "weekly", priority: "0.8" },
          { path: "/guides/transfer-pi", changefreq: "monthly", priority: "0.8" },
          { path: "/docs", changefreq: "weekly", priority: "0.9" },
          { path: "/docs/faq", changefreq: "monthly", priority: "0.7" },
          { path: "/docs/errors", changefreq: "monthly", priority: "0.7" },
          { path: "/docs/auth", changefreq: "monthly", priority: "0.75" },
          { path: "/docs/openpay", changefreq: "monthly", priority: "0.8" },
          { path: "/docs/exchange", changefreq: "monthly", priority: "0.8" },
          { path: "/docs/money", changefreq: "monthly", priority: "0.8" },
          { path: "/docs/tokens", changefreq: "monthly", priority: "0.75" },
          { path: "/docs/api", changefreq: "monthly", priority: "0.85" },
          { path: "/docs/ledger", changefreq: "monthly", priority: "0.8" },
          { path: "/docs/mcp", changefreq: "monthly", priority: "0.75" },
          { path: "/testnet-reward", changefreq: "monthly", priority: "0.6" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/regulatory", changefreq: "yearly", priority: "0.3" },
          ...WIKI_GUIDES.map((g) => ({
            path: `/wiki/${g.slug}`,
            changefreq: "monthly" as const,
            priority: "0.75",
          })),
          ...BLOG_POSTS.map((p) => ({
            path: `/blog/${p.slug}`,
            changefreq: "monthly" as const,
            priority: "0.7",
          })),
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
