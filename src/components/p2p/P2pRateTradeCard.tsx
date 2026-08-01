import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { notifySuccess } from "@/lib/notify-success";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  P2P_RATING_TAGS,
  fetchMyRatingForOrder,
  submitOrderRating,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

export function P2pRateTradeCard({
  orderId,
  counterpartyName,
}: {
  orderId: string;
  counterpartyName: string;
}) {
  const qc = useQueryClient();
  const [score, setScore] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  const existingQ = useQuery({
    queryKey: ["p2p-my-rating", orderId],
    queryFn: () => fetchMyRatingForOrder(orderId),
  });

  const submit = useMutation({
    mutationFn: () =>
      submitOrderRating({
        orderId,
        score,
        tags,
        comment: comment.trim() || null,
      }),
    onSuccess: () => {
      notifySuccess("Thanks for your rating", { sound: "success" });
      void qc.invalidateQueries({ queryKey: ["p2p-my-rating", orderId] });
      void qc.invalidateQueries({ queryKey: ["p2p-rating-stats"] });
      void qc.invalidateQueries({ queryKey: ["p2p-stats-self"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (existingQ.isLoading) {
    return (
      <div className="grid place-items-center rounded-[8px] border border-border/50 bg-muted/20 py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const existing = existingQ.data;
  if (existing?.id) {
    return (
      <div className="rounded-[8px] border border-[#11C66D]/25 bg-[#11C66D]/8 px-4 py-3">
        <p className="text-[13px] font-bold text-[#11C66D]">You rated {counterpartyName}</p>
        <div className="mt-1.5 flex items-center gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={cn(
                "h-4 w-4",
                i < existing.score ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
              )}
            />
          ))}
          <span className="ml-2 text-[11px] text-muted-foreground">{existing.score}/5</span>
        </div>
        {existing.tags?.length ? (
          <p className="mt-2 text-[11px] text-muted-foreground">{existing.tags.join(" · ")}</p>
        ) : null}
        {existing.comment ? (
          <p className="mt-1 text-[12px] text-foreground/80">{existing.comment}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[8px] border border-border/50 bg-card/40 px-4 py-3.5">
      <div>
        <p className="text-[13px] font-extrabold">Rate {counterpartyName}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Help others trade safer — same as OKX / Bitget post-trade reviews.
        </p>
      </div>

      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, i) => {
          const n = i + 1;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} stars`}
              onClick={() => setScore(n)}
              className="p-0.5 press"
            >
              <Star
                className={cn(
                  "h-7 w-7 transition-colors",
                  n <= score ? "fill-amber-400 text-amber-400" : "text-muted-foreground/35",
                )}
              />
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {P2P_RATING_TAGS.map((tag) => {
          const on = tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() =>
                setTags((prev) => (on ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 8)))
              }
              className={cn(
                "h-7 rounded-full px-2.5 text-[11px] font-semibold transition-colors",
                on
                  ? "bg-[#11C66D] text-white"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              {tag}
            </button>
          );
        })}
      </div>

      <Input
        value={comment}
        maxLength={500}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment"
        className="h-10 rounded-[8px] text-[13px]"
      />

      <Button
        className="h-10 w-full rounded-[8px] bg-[#11C66D] font-bold text-white hover:bg-[#0FB461]"
        disabled={submit.isPending}
        onClick={() => submit.mutate()}
      >
        {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit rating"}
      </Button>
    </div>
  );
}
