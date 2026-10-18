import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Loader2, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import { useSpeech } from "@/hooks/use-speech";
import {
  getWikiGuide,
  wikiGuideSpeechText,
  WIKI_GUIDES,
  type WikiGuide,
} from "@/lib/wiki-guides";
import { cn } from "@/lib/utils";

const SITE = "https://openpaypro.space";

export const Route = createFileRoute("/wiki_/$slug")({
  loader: ({ params }) => {
    const guide = getWikiGuide(params.slug);
    if (!guide) throw notFound();
    return { guide };
  },
  head: ({ params, loaderData }) => {
    const guide = loaderData?.guide;
    if (!guide) {
      return {
        meta: [{ title: "Guide not found — OpenPay Pro Wiki" }, { name: "robots", content: "noindex" }],
      };
    }
    const url = `${SITE}/wiki/${params.slug}`;
    return {
      meta: [
        { title: `${guide.title} — OpenPay Pro Wiki` },
        { name: "description", content: guide.dek },
        { property: "og:title", content: guide.title },
        { property: "og:description", content: guide.dek },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: WikiNotFound,
  component: WikiGuidePage,
});

function WikiNotFound() {
  return (
    <main className="opblog grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="opblog-h2">That wiki guide does not exist</h1>
        <Link to="/wiki" className="mt-4 inline-block font-semibold underline">
          Back to the Wiki
        </Link>
      </div>
    </main>
  );
}

function WikiGuidePage() {
  const { guide } = Route.useLoaderData() as { guide: WikiGuide };
  const speech = useSpeech();
  const speechId = `wiki:${guide.slug}`;
  const isSpeaking = speech.speakingId === speechId;
  const isLoadingAudio = speech.loadingId === speechId;
  const more = WIKI_GUIDES.filter((g) => g.slug !== guide.slug && g.category === guide.category).slice(
    0,
    3,
  );
  const fallbackMore =
    more.length > 0
      ? more
      : WIKI_GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 3);

  const listen = () => {
    void speech.speak(speechId, wikiGuideSpeechText(guide));
  };

  const share = async () => {
    const url = `${SITE}/wiki/${guide.slug}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: guide.title, url });
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      await copyText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <main className="opblog min-h-screen">
      <div className="mx-auto w-full max-w-[1180px] px-5 pb-24 pt-8 sm:px-8">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Link to="/wiki" className="rounded-full bg-[var(--muted)] px-3 py-1.5">
            Wiki
          </Link>
          <span className="text-[var(--muted-foreground)]">›</span>
          <span className="rounded-full bg-[var(--muted)] px-3 py-1.5 text-[var(--muted-foreground)]">
            {guide.category}
          </span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
          <article className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              {guide.category} · {guide.level} · {guide.minutes} min
            </p>
            <h1 className="opblog-title mt-3">{guide.title}</h1>
            <p className="opblog-dek mt-5 max-w-2xl text-[var(--foreground)]/80">{guide.dek}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={listen}
                disabled={isLoadingAudio}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition press",
                  isSpeaking
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-105",
                )}
                aria-label={isSpeaking ? "Stop reading aloud" : "Listen to this guide"}
              >
                {isLoadingAudio ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isSpeaking ? (
                  <Square className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Volume2 className="h-4 w-4" strokeWidth={2.25} />
                )}
                {isLoadingAudio ? "Preparing audio…" : isSpeaking ? "Stop" : "Listen to guide"}
              </button>
              <button
                type="button"
                onClick={share}
                className="rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)]"
              >
                Share
              </button>
              {guide.tryPath ? (
                <a
                  href={guide.tryPath}
                  className="rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)]"
                >
                  Try in app
                </a>
              ) : null}
            </div>

            <div
              className="mt-10 grid aspect-[16/7] place-items-center rounded-3xl text-6xl font-black text-[color:rgba(61,46,99,0.28)]"
              style={{
                backgroundImage: `linear-gradient(135deg, ${guide.hero.from}, ${guide.hero.to})`,
              }}
              aria-hidden
            >
              {guide.hero.glyph}
            </div>

            <div className="opblog-body mt-12 max-w-[46rem] space-y-6">
              <p>{guide.intro}</p>

              {guide.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-28 space-y-5 pt-8">
                  <h2 className="opblog-h2">{section.heading}</h2>
                  {section.body ? <p>{section.body}</p> : null}

                  {section.steps?.length ? (
                    <ol className="space-y-4">
                      {section.steps.map((step, i) => (
                        <li
                          key={i}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5"
                        >
                          <div className="flex gap-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]">
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-lg font-bold tracking-tight">{step.title}</p>
                              <p className="mt-1.5 text-base leading-relaxed text-[var(--muted-foreground)]">
                                {step.detail}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : null}

                  {section.tips?.length ? (
                    <div className="rounded-2xl border-l-4 border-[var(--primary)] bg-[var(--accent)] px-5 py-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                        Tips
                      </p>
                      <ul className="mt-2 space-y-2">
                        {section.tips.map((tip, i) => (
                          <li key={i} className="text-base font-medium leading-relaxed">
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              ))}
            </div>

            <div className="mt-14 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-7">
              <h2 className="text-2xl font-bold tracking-tight">Try it in the wallet</h2>
              <p className="mt-2 text-[var(--muted-foreground)]">
                Open OpenPay Pro and follow this tutorial with the real screens.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {guide.tryPath ? (
                  <a
                    href={guide.tryPath}
                    className="inline-block rounded-full bg-[var(--primary)] px-6 py-3 font-semibold text-[var(--primary-foreground)]"
                  >
                    Open feature
                  </a>
                ) : null}
                <Link
                  to="/authpi"
                  className="inline-block rounded-full border border-[var(--border)] px-6 py-3 font-semibold"
                >
                  Sign in
                </Link>
              </div>
            </div>

            <div className="mt-14">
              <h2 className="text-xl font-bold tracking-tight">More tutorials</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {fallbackMore.map((g) => (
                  <Link
                    key={g.slug}
                    to="/wiki/$slug"
                    params={{ slug: g.slug }}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--primary)]"
                  >
                    <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                      {g.category}
                    </p>
                    <p className="mt-2 font-bold leading-snug">{g.title}</p>
                  </Link>
                ))}
              </div>
            </div>
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <button
                type="button"
                onClick={listen}
                disabled={isLoadingAudio}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold press",
                  isSpeaking
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "bg-[var(--primary)] text-[var(--primary-foreground)]",
                )}
              >
                {isLoadingAudio ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isSpeaking ? (
                  <Square className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
                {isSpeaking ? "Stop listening" : "Listen to guide"}
              </button>

              <div className="rounded-2xl bg-[var(--muted)] p-5">
                <p className="text-sm font-bold">Contents</p>
                <ul className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
                  {guide.sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="text-sm font-semibold leading-snug text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
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
