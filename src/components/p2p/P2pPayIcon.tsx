import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { logoCandidatesForP2pPayment } from "@/lib/p2p-payment-logos";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE: Record<Size, { box: string; img: string; text: string }> = {
  xs: { box: "h-4 w-4 rounded-[3px]", img: "h-3 w-3", text: "text-[8px]" },
  sm: { box: "h-5 w-5 rounded-[4px]", img: "h-3.5 w-3.5", text: "text-[9px]" },
  md: { box: "h-7 w-7 rounded-md", img: "h-[18px] w-[18px]", text: "text-[10px]" },
  lg: { box: "h-9 w-9 rounded-lg", img: "h-6 w-6", text: "text-xs" },
};

function initials(name?: string, code?: string) {
  const src = (name || code || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

/** Real payment-brand logo (with favicon / local SVG fallbacks). */
export function P2pPayIcon({
  code,
  name,
  logoUrl,
  size = "sm",
  className,
}: {
  code: string;
  name?: string;
  /** Prefer DB logo_url when present. */
  logoUrl?: string | null;
  size?: Size;
  className?: string;
}) {
  const candidates = logoCandidatesForP2pPayment(code, logoUrl);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [code, logoUrl]);

  const src = candidates[idx];
  const dim = SIZE[size];
  const isFlag = !!src && (src.includes("flagcdn.com") || /\/[a-z]{2}\.svg(\?|$)/i.test(src));

  if (!src) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center bg-muted font-bold text-muted-foreground",
          dim.box,
          dim.text,
          className,
        )}
        aria-hidden
      >
        {initials(name, code)}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden ring-1 ring-black/5",
        isFlag ? "bg-muted/40" : "bg-white",
        dim.box,
        className,
      )}
      aria-hidden
    >
      <img
        key={src}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn(isFlag ? "h-full w-full object-cover" : cn("object-contain", dim.img))}
        onError={() => setIdx((i) => i + 1)}
      />
    </span>
  );
}

/** Compact chip: logo + label (marketplace / filters). */
export function P2pPayChip({
  code,
  label,
  className,
  size = "sm",
}: {
  code: string;
  label: string;
  className?: string;
  size?: Size;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 truncate text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      <P2pPayIcon code={code} name={label} size={size} />
      <span className="truncate">{label}</span>
    </span>
  );
}
