import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Heart, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuthUser } from "@/hooks/use-auth-user";
import { useOrbitFeed } from "@/lib/exchange-social";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/exchange/orbit")({
  head: () => ({
    meta: [
      { title: "Orbit feed · OpenPay Pro Exchange" },
      {
        name: "description",
        content:
          "Share market calls and read what other OpenPay Pro traders are posting in the Orbit community feed.",
      },
      { property: "og:title", content: "Orbit feed · OpenPay Pro Exchange" },
      {
        property: "og:description",
        content: "Trader posts, market tags and likes inside OpenPay Pro Exchange mode.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrbitPage,
});

function OrbitPage() {
  const { user } = useAuthUser();
  const { posts, isLoading, createPost, toggleLike, deletePost } = useOrbitFeed(user?.id);
  const [body, setBody] = useState("");
  const [symbol, setSymbol] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await createPost(body, symbol.trim().toUpperCase() || null);
      setBody("");
      setSymbol("");
      toast.success("Posted to Orbit");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-page-in pb-6">
      <h1 className="mb-4 text-xl font-black tracking-tight">Orbit</h1>

      <div className="mb-6 rounded-2xl bg-muted/40 p-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Share a market take…"
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-2 flex items-center gap-2">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="$SYMBOL"
            maxLength={12}
            className="w-28 rounded-full bg-background/70 px-3 py-1.5 text-xs font-semibold uppercase outline-none placeholder:normal-case placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !body.trim()}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground press disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Post
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No posts yet — be the first to share a call.
        </p>
      ) : (
        <ul className="divide-y divide-border/40">
          {posts.map((p) => (
            <li key={p.id} className="py-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-xs font-bold">
                  {p.author.avatar ? (
                    <img src={p.author.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    p.author.name.slice(0, 2).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="truncate font-bold">{p.author.name}</span>
                    <span className="text-muted-foreground">{timeAgo(p.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{p.body}</p>
                  <div className="mt-2 flex items-center gap-3">
                    {p.symbol && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-success">
                        ${p.symbol}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        toggleLike(p.id, p.liked).catch((e) =>
                          toast.error(e instanceof Error ? e.message : "Could not like"),
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1 text-xs press",
                        p.liked ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      <Heart className={cn("h-4 w-4", p.liked && "fill-current")} />
                      {p.likes}
                    </button>
                    {p.user_id === user?.id && (
                      <button
                        type="button"
                        onClick={() =>
                          deletePost(p.id).catch((e) =>
                            toast.error(e instanceof Error ? e.message : "Could not delete"),
                          )
                        }
                        className="ml-auto text-muted-foreground press"
                        aria-label="Delete post"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
