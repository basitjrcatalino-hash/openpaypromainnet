import { Link } from "@tanstack/react-router";
import { OUSD_LOGO_URL, PI_NETWORK_LOGO_URL } from "@/lib/token-logos";
import { cn } from "@/lib/utils";

type Tone = "light" | "dark" | "lavender";

const TONE: Record<
  Tone,
  { shell: string; card: string; title: string; body: string; chip: string; badge: string }
> = {
  light: {
    shell: "border-border/80 bg-white/70",
    card: "border-border bg-white",
    title: "text-foreground",
    body: "text-muted-foreground",
    chip: "bg-muted text-foreground",
    badge: "bg-primary/15 text-primary",
  },
  dark: {
    shell: "border-white/15 bg-white/10 backdrop-blur-md",
    card: "border-white/15 bg-white/10",
    title: "text-white",
    body: "text-white/75",
    chip: "bg-white/15 text-white",
    badge: "bg-[rgba(171,159,242,0.35)] text-white",
  },
  lavender: {
    shell: "border-border/80 bg-card/80",
    card: "border-border bg-card",
    title: "text-foreground",
    body: "text-muted-foreground",
    chip: "bg-muted text-foreground",
    badge: "bg-primary/20 text-primary-foreground",
  },
};

/**
 * Persistent marketing highlight: OpenUSD + Pi Network as the main Pro tokens.
 */
export function MainTokensHighlight({
  tone = "light",
  className,
  compact = false,
}: {
  tone?: Tone;
  className?: string;
  compact?: boolean;
}) {
  const t = TONE[tone];

  return (
    <div className={cn("rounded-[1.5rem] border p-4 sm:p-5", t.shell, className)} data-main-tokens>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
            t.badge,
          )}
        >
          Main tokens
        </span>
        {!compact ? (
          <p className={cn("text-sm font-semibold", t.body)}>
            OpenUSD and Pi Network lead every OpenPay Pro wallet.
          </p>
        ) : null}
      </div>

      <div className={cn("mt-3 grid gap-3", compact ? "sm:grid-cols-2" : "sm:grid-cols-2")}>
        <Link
          to="/openusd"
          className={cn(
            "flex items-center gap-3 rounded-2xl border p-3 transition hover:brightness-105",
            t.card,
          )}
        >
          <img
            src={OUSD_LOGO_URL}
            alt=""
            className="h-12 w-12 shrink-0 rounded-2xl object-cover shadow-sm"
          />
          <div className="min-w-0 text-left">
            <p className={cn("text-base font-extrabold tracking-tight", t.title)}>OpenUSD</p>
            <p className={cn("text-sm font-semibold", t.body)}>OUSD · $1 ledger dollar</p>
          </div>
          <span
            className={cn(
              "ml-auto shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold",
              t.chip,
            )}
          >
            Primary
          </span>
        </Link>

        <div className={cn("flex items-center gap-3 rounded-2xl border p-3", t.card)}>
          <img
            src={PI_NETWORK_LOGO_URL}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover shadow-sm"
          />
          <div className="min-w-0 text-left">
            <p className={cn("text-base font-extrabold tracking-tight", t.title)}>Pi Network</p>
            <p className={cn("text-sm font-semibold", t.body)}>PI · Core Pro asset · top-up rail</p>
          </div>
          <span
            className={cn(
              "ml-auto shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold",
              t.chip,
            )}
          >
            Core
          </span>
        </div>
      </div>
    </div>
  );
}
