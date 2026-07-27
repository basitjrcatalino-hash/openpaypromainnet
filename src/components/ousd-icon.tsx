import { OUSD_LOGO_URL, OUSD_LOGO_FALLBACK_URL } from "@/lib/token-logos";
import { cn } from "@/lib/utils";

export function OusdIcon({ className, alt = "OpenPay OUSD" }: { className?: string; alt?: string }) {
  return (
    <img
      src={OUSD_LOGO_URL}
      alt={alt}
      className={cn("h-10 w-10 shrink-0 rounded-full object-cover", className)}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const img = e.currentTarget;
        if (img.src !== OUSD_LOGO_FALLBACK_URL) {
          img.src = OUSD_LOGO_FALLBACK_URL;
        }
      }}
    />
  );
}
