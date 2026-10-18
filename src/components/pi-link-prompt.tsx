import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Link2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DISMISS_KEY = "opp:pi-link-prompt-dismissed";

/** Asks Pi-signed-in users to link an Arc wallet so they keep access as OpenPay moves to OpenPay Arc. */
export function PiLinkPrompt({ userId, piUsername }: { userId: string; piUsername?: string | null }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === userId);
  }, [userId]);

  const { data: linked } = useQuery({
    queryKey: ["arc-linked", userId],
    enabled: !!piUsername,
    queryFn: async () => {
      const { data } = await supabase
        .from("arc_wallet_links")
        .select("address")
        .eq("user_id", userId)
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
  });

  if (!piUsername || dismissed || linked !== false) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Link2 className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Link a wallet to keep your account</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          OpenPay Pro is now powered by OpenPay and OpenPay Arc. Link an Arc wallet so you can always sign in.
        </p>
        <Link
          to="/arc"
          className="mt-2 inline-flex rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground press"
        >
          Link Arc wallet
        </Link>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, userId);
          setDismissed(true);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
