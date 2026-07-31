import { Loader2, Square, Volume2 } from "lucide-react";
import { useSpeech } from "@/hooks/use-speech";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ink" | "outline" | "ghost" | "muted";

const VARIANTS: Record<Variant, { idle: string; active: string }> = {
  primary: {
    idle: "bg-primary text-primary-foreground hover:brightness-105",
    active: "bg-foreground text-background",
  },
  ink: {
    idle: "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90",
    active: "bg-[var(--primary)] text-[var(--primary-foreground)]",
  },
  outline: {
    idle: "border border-border bg-card text-foreground hover:bg-muted",
    active: "bg-foreground text-background",
  },
  ghost: {
    idle: "bg-muted text-muted-foreground hover:text-foreground",
    active: "bg-foreground text-background",
  },
  muted: {
    idle: "bg-white/80 text-[var(--ink,var(--foreground))] shadow-sm ring-1 ring-black/5 hover:bg-white",
    active: "bg-[var(--ink,var(--foreground))] text-white",
  },
};

export function PageListenButton({
  id,
  text,
  label = "Listen",
  stopLabel = "Stop",
  preparingLabel = "Preparing audio…",
  variant = "primary",
  className,
  size = "md",
}: {
  id: string;
  text: string;
  label?: string;
  stopLabel?: string;
  preparingLabel?: string;
  variant?: Variant;
  className?: string;
  size?: "sm" | "md";
}) {
  const speech = useSpeech();
  const isSpeaking = speech.speakingId === id;
  const isLoading = speech.loadingId === id;
  const styles = VARIANTS[variant];

  return (
    <button
      type="button"
      onClick={() => void speech.speak(id, text)}
      disabled={isLoading}
      className={cn(
        "inline-flex items-center gap-2 rounded-full font-semibold transition press",
        size === "sm" ? "px-3.5 py-2 text-xs" : "px-5 py-2.5 text-sm",
        isSpeaking ? styles.active : styles.idle,
        className,
      )}
      aria-label={isSpeaking ? "Stop reading aloud" : "Listen to this page"}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSpeaking ? (
        <Square className="h-3.5 w-3.5 fill-current" />
      ) : (
        <Volume2 className="h-4 w-4" strokeWidth={2.25} />
      )}
      {isLoading ? preparingLabel : isSpeaking ? stopLabel : label}
    </button>
  );
}
