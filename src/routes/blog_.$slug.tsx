import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import { BLOG_POSTS, formatBlogDate, getPost, type BlogPost } from "@/lib/blog-posts";

const SITE = "https://openpaypro.space";

export const Route = createFileRoute("/blog_/$slug")({
  loader: ({ params }) => {
    const post = getPost(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ params, loaderData }) => {
    const post = loaderData?.post;
    if (!post) {
      return {
        meta: [{ title: "Article not found — OpenPay Pro Blog" }, { name: "robots", content: "noindex" }],
      };
    }
    const url = `${SITE}/blog/${params.slug}`;
    return {
      meta: [
        { title: `${post.title} — OpenPay Pro` },
        { name: "description", content: post.dek },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.dek },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.dek,
            datePublished: post.date,
            author: { "@type": "Organization", name: post.author },
            mainEntityOfPage: url,
          }),
        },
      ],
    };
  },
  notFoundComponent: BlogNotFound,
  component: BlogArticle,
});

function BlogNotFound() {
  return (
    <main className="opblog grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="opblog-h2">That article does not exist</h1>
        <Link to="/blog" className="mt-4 inline-block font-semibold underline">
          Back to the blog
        </Link>
      </div>
    </main>
  );
}

function BlogArticle() {
  const { post } = Route.useLoaderData() as { post: BlogPost };
  const activeId = useActiveSection(post.sections.map((s: BlogPost["sections"][number]) => s.id));

  const share = async () => {
    const url = `${SITE}/blog/${post.slug}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: post.title, url });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      await copyText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const more = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <main className="opblog min-h-screen">
      <div className="mx-auto w-full max-w-[1180px] px-5 pb-24 pt-8 sm:px-8">
        <nav className="mb-10 flex items-center gap-2 text-sm font-semibold">
          <Link to="/blog" className="rounded-full bg-[var(--muted)] px-3 py-1.5">
            Learn
          </Link>
          <span className="text-[var(--muted-foreground)]">›</span>
          <span className="rounded-full bg-[var(--muted)] px-3 py-1.5">Blog</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[80px_minmax(0,1fr)_260px]">
          {/* Share rail */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <button
                type="button"
                onClick={share}
                className="rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-105"
              >
                Share
              </button>
            </div>
          </div>

          {/* Article */}
          <article className="min-w-0">
            <h1 className="opblog-title">{post.title}</h1>
            <p className="opblog-dek mt-6 max-w-2xl text-[var(--foreground)]/80">{post.dek}</p>
            <p className="mt-6 text-sm text-[var(--muted-foreground)]">
              <span className="italic">{post.author}</span> · {formatBlogDate(post.date)} ·{" "}
              {post.readMinutes} min read
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-lg bg-[var(--muted)] px-2.5 py-1.5 text-xs font-semibold">
                <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
                {post.level}
              </span>
              <span className="rounded-lg bg-[var(--muted)] px-2.5 py-1.5 text-xs font-semibold">
                {post.category}
              </span>
            </div>

            <div
              className="mt-10 grid aspect-[16/7] place-items-center rounded-3xl text-7xl font-black text-[color:rgba(61,46,99,0.28)]"
              style={{
                backgroundImage: `linear-gradient(135deg, ${post.hero.from}, ${post.hero.to})`,
              }}
              aria-hidden
            >
              {post.hero.glyph}
            </div>

            <div className="opblog-body mt-12 max-w-[46rem] space-y-6">
              {post.intro.map((text, i) => (
                <p key={i}>{text}</p>
              ))}

              {post.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-28 space-y-6 pt-8">
                  <h2 className="opblog-h2">{section.heading}</h2>
                  {section.blocks.map((block, i) => {
                    if (block.type === "p") return <p key={i}>{block.text}</p>;
                    if (block.type === "quote")
                      return (
                        <blockquote
                          key={i}
                          className="rounded-2xl border-l-4 border-[var(--primary)] bg-[var(--accent)] px-6 py-5 text-lg font-medium leading-relaxed"
                        >
                          {block.text}
                        </blockquote>
                      );
                    if (block.type === "list")
                      return (
                        <ul key={i} className="space-y-3 pl-1">
                          {block.items.map((item, j) => (
                            <li key={j} className="flex gap-3 text-lg leading-relaxed">
                              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      );
                    return (
                      <ol key={i} className="space-y-3">
                        {block.items.map((item, j) => (
                          <li key={j} className="flex gap-3 text-lg leading-relaxed">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]">
                              {j + 1}
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    );
                  })}
                </section>
              ))}
            </div>

            <div className="mt-14 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-7">
              <h2 className="text-2xl font-bold tracking-tight">Try it in the wallet</h2>
              <p className="mt-2 text-[var(--muted-foreground)]">
                Open OpenPay Pro and follow along with this guide.
              </p>
              <Link
                to="/authpi"
                className="mt-5 inline-block rounded-full bg-[var(--primary)] px-6 py-3 font-semibold text-[var(--primary-foreground)]"
              >
                Open OpenPay Pro
              </Link>
            </div>

            <div className="mt-14">
              <h2 className="text-xl font-bold tracking-tight">Keep reading</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {more.map((p) => (
                  <Link
                    key={p.slug}
                    to="/blog/$slug"
                    params={{ slug: p.slug }}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--primary)]"
                  >
                    <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                      {p.category}
                    </p>
                    <p className="mt-2 font-bold leading-snug">{p.title}</p>
                  </Link>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={share}
              className="mt-10 w-full rounded-full bg-[var(--primary)] px-5 py-3 font-semibold text-[var(--primary-foreground)] lg:hidden"
            >
              Share this article
            </button>
          </article>

          {/* Contents */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl bg-[var(--muted)] p-5">
              <p className="text-sm font-bold">Contents</p>
              <div className="mt-3 border-t border-[var(--border)] pt-3">
                <ul className="space-y-3">
                  {post.sections.map((s) => (
                    <li key={s.id} className="flex gap-2">
                      <span
                        className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                          activeId === s.id ? "bg-[#22c55e]" : "bg-transparent"
                        }`}
                      />
                      <a
                        href={`#${s.id}`}
                        className={`text-sm font-semibold leading-snug ${
                          activeId === s.id
                            ? "text-[var(--foreground)]"
                            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {s.heading}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids.join("|")]);

  return active;
}

export type { BlogPost };
