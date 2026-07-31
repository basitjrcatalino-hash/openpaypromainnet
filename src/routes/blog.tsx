import { createFileRoute, Link } from "@tanstack/react-router";
import { BLOG_POSTS, formatBlogDate } from "@/lib/blog-posts";

const TITLE = "OpenPay Pro Blog — Guides to Every Wallet Feature";
const DESC =
  "Deep guides to OpenPay Pro: top ups, transfers, multi-chain deposits, the merchant gateway, KYC, tokens, security, and developer APIs.";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://openpaypro.space/blog" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/blog" }],
  }),
  component: BlogIndex,
});

const LEVEL_DOT: Record<string, string> = {
  Beginner: "#22c55e",
  Intermediate: "#f59e0b",
  Advanced: "#ef4444",
};

function BlogIndex() {
  const [featured, ...rest] = BLOG_POSTS;

  return (
    <main className="opblog min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-5 pb-24 pt-10 sm:px-8">
        <nav className="mb-10 flex items-center gap-2 text-sm font-semibold">
          <Link
            to="/authpi"
            className="rounded-full bg-[var(--muted)] px-3 py-1.5 text-[var(--foreground)]/80 hover:text-[var(--foreground)]"
          >
            OpenPay Pro
          </Link>
          <span className="text-[var(--muted-foreground)]">›</span>
          <span className="rounded-full bg-[var(--muted)] px-3 py-1.5">Blog</span>
        </nav>

        <header className="max-w-3xl">
          <h1 className="opblog-title">Learn OpenPay Pro</h1>
          <p className="opblog-dek mt-5 text-[var(--muted-foreground)]">
            One guide per feature — written the way we would explain it to a colleague. Start
            anywhere.
          </p>
        </header>

        {featured && (
          <Link
            to="/blog/$slug"
            params={{ slug: featured.slug }}
            className="group mt-12 grid gap-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 transition hover:border-[var(--primary)] sm:p-7 lg:grid-cols-[1.1fr_1fr] lg:items-center"
          >
            <div
              className="grid aspect-[16/9] place-items-center rounded-2xl text-6xl font-black text-[color:rgba(61,46,99,0.35)]"
              style={{
                backgroundImage: `linear-gradient(135deg, ${featured.hero.from}, ${featured.hero.to})`,
              }}
              aria-hidden
            >
              {featured.hero.glyph}
            </div>
            <div className="min-w-0">
              <PostTags post={featured} />
              <h2 className="opblog-h2 mt-4 group-hover:underline">{featured.title}</h2>
              <p className="mt-3 text-base leading-relaxed text-[var(--muted-foreground)]">
                {featured.dek}
              </p>
              <p className="mt-4 text-sm italic text-[var(--muted-foreground)]">
                {featured.author} · {formatBlogDate(featured.date)} · {featured.readMinutes} min read
              </p>
            </div>
          </Link>
        )}

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((post) => (
            <Link
              key={post.slug}
              to="/blog/$slug"
              params={{ slug: post.slug }}
              className="group flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 transition hover:border-[var(--primary)]"
            >
              <div
                className="grid aspect-[16/10] place-items-center rounded-2xl text-4xl font-black text-[color:rgba(61,46,99,0.3)]"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${post.hero.from}, ${post.hero.to})`,
                }}
                aria-hidden
              >
                {post.hero.glyph}
              </div>
              <div className="mt-5 min-w-0 flex-1">
                <PostTags post={post} />
                <h3 className="mt-3 text-xl font-bold leading-snug tracking-tight group-hover:underline">
                  {post.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {post.dek}
                </p>
              </div>
              <p className="mt-4 text-xs italic text-[var(--muted-foreground)]">
                {formatBlogDate(post.date)} · {post.readMinutes} min read
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

function PostTags({ post }: { post: (typeof BLOG_POSTS)[number] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-2 rounded-lg bg-[var(--muted)] px-2.5 py-1 text-xs font-semibold">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: LEVEL_DOT[post.level] ?? "#22c55e" }}
        />
        {post.level}
      </span>
      <span className="rounded-lg bg-[var(--muted)] px-2.5 py-1 text-xs font-semibold">
        {post.category}
      </span>
    </div>
  );
}
