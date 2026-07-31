import { useMemo, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { APP_LANGUAGES, type AppLanguage } from "@/i18n/languages";
import { useIsDesktopViewport } from "@/hooks/use-mobile";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onSelect: (code: string) => void;
};

function LanguageList({
  value,
  query,
  onSelect,
}: {
  value: string;
  query: string;
  onSelect: (code: string) => void;
}) {
  const { t } = useTranslation();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return APP_LANGUAGES;
    return APP_LANGUAGES.filter((l) => {
      const hay = `${l.nativeName} ${l.englishName} ${l.code}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  if (filtered.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        {t("language.noResults")}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-muted/60 dark:bg-muted/40">
      {filtered.map((lang) => (
        <LanguageRow
          key={lang.code}
          language={lang}
          selected={lang.code === value}
          onSelect={() => onSelect(lang.code)}
        />
      ))}
    </ul>
  );
}

function LanguageRow({
  language,
  selected,
  onSelect,
}: {
  language: AppLanguage;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left press hover:bg-muted/80"
      >
        <span className="min-w-0 truncate text-[15px] font-medium text-foreground">
          {language.nativeName}
        </span>
        <span
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
            selected ? "border-primary bg-primary" : "border-muted-foreground/50 bg-background",
          )}
          aria-hidden
        >
          {selected ? <span className="h-2 w-2 rounded-full bg-primary-foreground" /> : null}
        </span>
      </button>
    </li>
  );
}

function PickerBody({
  value,
  onSelect,
  onBack,
}: {
  value: string;
  onSelect: (code: string) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-foreground press"
          aria-label={t("common.back")}
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <h2 className="text-lg font-bold tracking-tight text-foreground">{t("language.title")}</h2>
      </div>

      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("language.searchPlaceholder")}
          className="h-11 rounded-full border-0 bg-muted pl-10 text-[15px] placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/40"
          autoFocus={false}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
        <LanguageList value={value} query={query} onSelect={onSelect} />
      </div>
    </div>
  );
}

/**
 * Phantom-style display language picker — full-height bottom sheet on mobile,
 * centered dialog on desktop. Radio rows with native language names.
 */
export function LanguagePickerSheet({ open, onOpenChange, value, onSelect }: Props) {
  const { t } = useTranslation();
  const isDesktop = useIsDesktopViewport();

  const handleSelect = (code: string) => {
    onSelect(code);
    onOpenChange(false);
  };

  if (!isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[92dvh] max-h-[92dvh] flex-col gap-0 rounded-t-[1.75rem] border-border/40 bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 [&>button.absolute]:hidden"
        >
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/35" />
          <SheetHeader className="sr-only">
            <SheetTitle>{t("language.title")}</SheetTitle>
            <SheetDescription>{t("language.subtitle")}</SheetDescription>
          </SheetHeader>
          <PickerBody value={value} onSelect={handleSelect} onBack={() => onOpenChange(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[min(100%-2rem,28rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[1.75rem] border-border/40 bg-card p-5 shadow-2xl [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("language.title")}</DialogTitle>
          <DialogDescription>{t("language.subtitle")}</DialogDescription>
        </DialogHeader>
        <PickerBody value={value} onSelect={handleSelect} onBack={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
