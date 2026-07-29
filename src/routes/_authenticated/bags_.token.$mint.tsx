import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/wallet/PageHeader";
import { Button } from "@/components/ui/button";
import { bagsTokenFees } from "@/lib/bags.functions";
import { bagsTokenUrl } from "@/lib/bags-client";

export const Route = createFileRoute("/_authenticated/bags_/token/$mint")({
  head: ({ params }) => ({
    meta: [{ title: `Bags ${params.mint.slice(0, 8)}… — OpenPay Pro` }],
  }),
  component: BagsTokenPage,
});

function BagsTokenPage() {
  const { mint } = Route.useParams();
  const feesFn = useServerFn(bagsTokenFees);

  const { data, isLoading, error } = useQuery({
    queryKey: ["bags-token-fees", mint],
    queryFn: () => feesFn({ data: { tokenMint: mint } }),
    retry: 1,
  });

  return (
    <div className="mx-auto w-full max-w-lg pb-10">
      <PageHeader title="Token analytics" backTo="/bags" />

      <div className="mb-4 break-all rounded-2xl bg-muted/50 px-3 py-2.5 font-mono text-xs">
        {mint}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button asChild size="sm" className="rounded-full">
          <a href={bagsTokenUrl(mint)} target="_blank" rel="noreferrer">
            bags.fm <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </a>
        </Button>
        <Button asChild size="sm" variant="secondary" className="rounded-full">
          <Link to="/bags/fees">Claim fees</Link>
        </Button>
        <Button asChild size="sm" variant="secondary" className="rounded-full">
          <Link to="/bags/trade">Trade</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="rounded-2xl bg-destructive/10 px-3 py-3 text-sm text-destructive">
          {(error as Error).message || "Failed to load analytics"}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-card px-4 py-3 ring-1 ring-border/60">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Lifetime fees
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {data?.lifetimeFees ?? "—"}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-bold">Creators</h2>
            {!data?.creators?.length ? (
              <p className="text-sm text-muted-foreground">No creator data</p>
            ) : (
              <ul className="space-y-2">
                {data.creators.map((c, i) => {
                  const wallet =
                    c && typeof c === "object" && "wallet" in c
                      ? String((c as { wallet?: string }).wallet ?? "")
                      : "";
                  const provider =
                    c && typeof c === "object" && "provider" in c
                      ? String((c as { provider?: string }).provider ?? "")
                      : "";
                  const username =
                    c && typeof c === "object" && "username" in c
                      ? String((c as { username?: string }).username ?? "")
                      : "";
                  return (
                    <li
                      key={`${wallet}-${i}`}
                      className="rounded-2xl bg-muted/40 px-3 py-2.5 text-sm"
                    >
                      <div className="font-semibold">
                        {username ? `@${username}` : wallet.slice(0, 12) || `Creator ${i + 1}`}
                      </div>
                      {provider ? (
                        <div className="text-xs text-muted-foreground">{provider}</div>
                      ) : null}
                      {wallet ? (
                        <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                          {wallet}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {data?.claimStats?.length ? (
            <div>
              <h2 className="mb-2 text-sm font-bold">Claim stats</h2>
              <ul className="space-y-2">
                {data.claimStats.map((s, i) => (
                  <li
                    key={`${s.wallet}-${i}`}
                    className="rounded-2xl bg-muted/40 px-3 py-2.5 text-sm"
                  >
                    <div className="font-mono text-xs">{s.wallet}</div>
                    <div className="text-muted-foreground">
                      Claimed: <span className="tabular-nums">{s.totalClaimed}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
