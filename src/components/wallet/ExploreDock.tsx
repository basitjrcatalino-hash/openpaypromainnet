import { Link } from "@tanstack/react-router";
import { Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Input } from "@/components/ui/input";
import { useChromeVisible } from "@/hooks/chrome-visible";
import { cn } from "@/lib/utils";

type ExploreDockProps = {
  query: string;
  onQueryChange: (value: string) => void;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Phantom-style floating search + mint FAB, portaled to body so page animations
 * never create a containing block for position:fixed.
 */
export function ExploreDock({
  query,
  onQueryChange,
  searchOpen,
  onSearchOpenChange,
  placeholder = "Search OpenPay",
  className,
}: ExploreDockProps) {
  const [mounted, setMounted] = useState(false);
  const chromeVisible = useChromeVisible();
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "ph-dock md:hidden transition-transform duration-300 ease-out",
        chromeVisible ? "translate-y-0" : "translate-y-[calc(100%+1rem)]",
        !chromeVisible && "pointer-events-none",
        className,
      )}
      role="search"
    >
      <div className="ph-dock-inner">
        {searchOpen ? (
          <>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder={placeholder}
                autoFocus
                className="h-12 rounded-full border-0 bg-muted/95 pl-10 text-sm shadow-lg backdrop-blur-xl"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                onSearchOpenChange(false);
                onQueryChange("");
              }}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-muted/95 text-muted-foreground shadow-lg backdrop-blur-xl press"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onSearchOpenChange(true)}
              className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-muted/95 px-4 text-left text-sm text-muted-foreground shadow-lg backdrop-blur-xl press"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">{query || placeholder}</span>
            </button>
            <Link
              to="/opentoken/create"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg press"
              aria-label="Mint / create coin"
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </Link>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
