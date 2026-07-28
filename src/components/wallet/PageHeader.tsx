import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  backTo?: string;
  onBack?: () => void;
  right?: ReactNode;
  className?: string;
};

export function PageHeader({ title, backTo, onBack, right, className }: Props) {
  const navigate = useNavigate();

  function handleBack() {
    if (onBack) onBack();
    else if (backTo) navigate({ to: backTo });
    else window.history.back();
  }

  return (
    <div
      className={cn(
        "ph-header sticky top-0 z-20 -mx-4 mb-2 flex items-center gap-2 px-4 py-3 md:-mx-0 md:rounded-2xl",
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
        onClick={handleBack}
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-center text-base font-bold">{title}</h1>
      <div className="flex h-9 w-9 shrink-0 items-center justify-end">{right}</div>
    </div>
  );
}
