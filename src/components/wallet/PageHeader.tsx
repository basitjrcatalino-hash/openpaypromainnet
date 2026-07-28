import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  /** Absolute app path, e.g. "/dashboard" */
  backTo?: string;
  onBack?: () => void;
  right?: ReactNode;
  className?: string;
};

export function PageHeader({ title, backTo, onBack, right, className }: Props) {
  const router = useRouter();

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    if (backTo) {
      void router.navigate({ to: backTo as "/dashboard" });
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
      return;
    }
    void router.navigate({ to: "/dashboard" });
  }

  return (
    <div
      className={cn(
        "ph-header sticky top-0 z-20 -mx-4 mb-2 flex items-center gap-2 px-4 py-3 md:mx-0 md:rounded-2xl",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
        onClick={handleBack}
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-center text-base font-bold">{title}</h1>
      <div className="flex h-9 min-w-9 shrink-0 items-center justify-end">{right ?? null}</div>
    </div>
  );
}
