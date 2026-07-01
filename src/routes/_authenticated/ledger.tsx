import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, formatUSD, shortAddress } from "@/lib/wallet-utils";

export const Route = createFileRoute("/_authenticated/ledger")({
  head: () => ({ meta: [{ title: "Public Ledger — OpenPay Pro" }] }),
  component: LedgerPage,
});

const BASE = typeof window !== "undefined" ? `${window.location.origin}/api/public/ledger` : "";

function LedgerPage() {
  const { data: entries = [] } = useQuery({
    queryKey: ["ledger-entries"],
    queryFn: async () =>
      (await supabase
        .from("ledger_entries" as any)
        .select("*")
        .order("sequence", { ascending: false })
        .limit(100)).data ?? [],
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Public Ledger</h1>
          <p className="text-sm text-muted-foreground">Append-only record of every OpenPay transaction — integrate via API.</p>
        </div>
        <Badge className="bg-primary/15 text-primary"><ScrollText className="mr-1 h-3 w-3" /> {entries.length} shown</Badge>
      </div>

      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">API Endpoints</h2>
        <div className="space-y-2 text-xs">
          {[
            ["GET", `${BASE}/entries`],
            ["GET", `${BASE}/entries/{id_or_sequence}`],
            ["GET", `${BASE}/stats`],
          ].map(([m, u]) => (
            <div key={u} className="flex items-center gap-2 rounded-xl bg-muted/40 p-2 font-mono">
              <Badge variant="outline" className="shrink-0">{m}</Badge>
              <code className="truncate flex-1">{u}</code>
              <button onClick={() => { navigator.clipboard.writeText(u); toast.success("Copied"); }} className="p-1 hover:bg-muted rounded">
                <Copy className="h-3 w-3" />
              </button>
            </div>
          ))}
          <p className="mt-2 text-muted-foreground">Auth: send header <code className="rounded bg-muted px-1">x-api-key: YOUR_KEY</code>. Full docs in <code>docs/LEDGER_API.md</code>.</p>
        </div>
      </Card>

      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent entries</h2>
        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="py-2 text-left">#</th>
                  <th className="py-2 text-left">Type</th>
                  <th className="py-2 text-left">From → To</th>
                  <th className="py-2 text-left">Asset</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2 text-right">USD</th>
                  <th className="py-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e: any) => (
                  <tr key={e.id} className="border-b border-border/40">
                    <td className="py-2 font-mono tabular-nums">{e.sequence}</td>
                    <td className="py-2 capitalize">{e.type}</td>
                    <td className="py-2 font-mono">{shortAddress(e.from_address)} → {shortAddress(e.to_address)}</td>
                    <td className="py-2">{e.asset ?? "—"}</td>
                    <td className="py-2 text-right tabular-nums">{formatNumber(e.amount, 6)}</td>
                    <td className="py-2 text-right tabular-nums">{formatUSD(e.usd_value)}</td>
                    <td className="py-2 text-right text-muted-foreground">{new Date(e.occurred_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
