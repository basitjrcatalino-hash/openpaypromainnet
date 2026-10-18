import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Volume2 } from "lucide-react";
import { WIKI_GUIDES, wikiCategories } from "@/lib/wiki-guides";

const TITLE = "OpenPay Pro Wiki — Step-by-step feature tutorials";
const DESC =
  "Phantom-style tutorials for every OpenPay Pro feature: sign-in, top up, send, deposit, swap, OpenToken, NFTs, AI, security, and developer tools. Listen with text-to-speech.";

export const Route = createFileRoute("/wiki")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://openpaypro.space/wiki" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/wiki" }],
  }),
  component: WikiIndex,
});

const LEVEL_DOT: Record<string, string> = {
  Beginner: "#22c55e",
  Intermediate: "#f59e0b",
  Advanced: "#ef4444",
};

function WikiIndex() {
  const categories = wikiCategories();

  return (
    <main className="opblog min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-5 pb-24 pt-10 sm:px-8">
        <nav className="mb-10 flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Link
            to="/authpi"
            className="rounded-full bg-[var(--muted)] px-3 py-1.5 text-[var(--foreground)]/80 hover:text-[var(--foreground)]"
          >
            OpenPay Pro
          </Link>
          <span className="text-[var(--muted-foreground)]">›</span>
          <span className="rounded-full bg-[var(--muted)] px-3 py-1.5">Wiki</span>
          <Link
            to="/blog"
            className="ml-auto rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Blog
          </Link>
        </nav>

        <header className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--muted)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]">
            <BookOpen className="h-3.5 w-3.5" strokeWidth={2.25} />
            Tutorials
            <span className="text-[var(--muted-foreground)]">·</span>
            <Volume2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            Listen aloud
          </div>
          <h1 className="opblog-title">OpenPay Pro Wiki</h1>
          <p className="opblog-dek mt-5 text-[var(--muted-foreground)]">
            Step-by-step guides for every wallet feature — designed like Phantom, written so you can
            follow along in the app. Open any guide and tap Listen to hear it with the same
            text-to-speech as OpenPay AI.
          </p>
        </header>

        <div className="mt-12 space-y-14">
          {categories.map((cat) => {
            const guides = WIKI_GUIDES.filter((g) => g.category === cat);
            return (
              <section key={cat}>
                <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  {cat}
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {guides.map((guide) => (
                    <Link
                      key={guide.slug}
                      to="/wiki/$slug"
                      params={{ slug: guide.slug }}
                      className="group flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 transition hover:border-[var(--primary)]"
                    >
                      <div
                        className="grid aspect-[16/9] place-items-center rounded-2xl text-3xl font-black text-[color:rgba(61,46,99,0.32)]"
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${guide.hero.from}, ${guide.hero.to})`,
                        }}
                        aria-hidden
                      >
                        {guide.hero.glyph}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-lg bg-[var(--muted)] px-2.5 py-1 text-xs font-semibold">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: LEVEL_DOT[guide.level] ?? "#22c55e" }}
                          />
                          {guide.level}
                        </span>
                        <span className="rounded-lg bg-[var(--muted)] px-2.5 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
                          {guide.minutes} min
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold leading-snug tracking-tight group-hover:underline">
                        {guide.title}
                      </h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
                        {guide.dek}
                      </p>
                      <p className="mt-4 text-xs font-semibold text-[var(--primary)]">
                        Open tutorial →
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
