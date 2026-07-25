import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ScrollText,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Ban,
  ShieldCheck,
  ExternalLink,
  BookOpen,
  Plug,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber, formatUSD, shortAddress } from "@/lib/wallet-utils";
import { openLedgerProEntryUrl } from "@/components/openledger-link";
import { checkIsAdmin, claimFirstAdmin } from "@/lib/topup-admin.functions";
import {
  activateLedgerApiKey,
  backfillLedgerEntries,
  createLedgerApiKey,
  getLedgerOverview,
  listLedgerApiKeys,
  listLedgerEntries,
  revokeLedgerApiKey,
} from "@/lib/ledger.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ledger")({
  head: () => ({ meta: [{ title: "Ledger API — OpenPay Pro" }] }),
  component: LedgerPage,
});

const TX_TYPES = ["all", "send", "receive", "buy", "sell", "swap", "mint", "reward"] as const;

function useApiBase() {
  return useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/api/public/ledger` : ""),
    [],
  );
}

function copyText(text: string, label = "Copied") {
  void navigator.clipboard.writeText(text);
  toast.success(label);
}

function LedgerPage() {
  const base = useApiBase();
  const qc = useQueryClient();
  const getOverview = useServerFn(getLedgerOverview);
  const listEntries = useServerFn(listLedgerEntries);
  const listKeys = useServerFn(listLedgerApiKeys);
  const createKey = useServerFn(createLedgerApiKey);
  const revokeKey = useServerFn(revokeLedgerApiKey);
  const activateKey = useServerFn(activateLedgerApiKey);
  const checkAdmin = useServerFn(checkIsAdmin);
  const claimAdmin = useServerFn(claimFirstAdmin);

  const [label, setLabel] = useState("openledger prod");
  const [plaintextKey, setPlaintextKey] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<(typeof TX_TYPES)[number]>("all");

  const overviewQ = useQuery({
    queryKey: ["ledger-overview"],
    queryFn: () => getOverview(),
    refetchInterval: 30_000,
  });

  const entriesQ = useQuery({
    queryKey: ["ledger-entries", typeFilter],
    queryFn: () =>
      listEntries({
        data: {
          type: typeFilter === "all" ? null : typeFilter,
          limit: 200,
        },
      }),
    refetchInterval: 15_000,
  });

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdmin() });
  const isAdmin = !!adminQ.data?.isAdmin || !!overviewQ.data?.isAdmin;

  const keysQ = useQuery({
    queryKey: ["ledger-api-keys"],
    queryFn: () => listKeys(),
    enabled: isAdmin,
  });

  const backfill = useServerFn(backfillLedgerEntries);
  const syncM = useMutation({
    mutationFn: () => backfill(),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["ledger-overview"] });
      void qc.invalidateQueries({ queryKey: ["ledger-entries"] });
      toast.success(
        res.inserted > 0
          ? `Synced ${res.inserted} missing transaction${res.inserted === 1 ? "" : "s"} to ledger`
          : "Ledger already complete — all transactions mirrored",
      );
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const createM = useMutation({
    mutationFn: () => createKey({ data: { label: label.trim() || "openledger" } }),
    onSuccess: (res) => {
      setPlaintextKey(res.plaintext);
      void qc.invalidateQueries({ queryKey: ["ledger-api-keys"] });
      toast.success("API key created — copy it now");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const syncSnippet = `const BASE = "${base || "https://YOUR_HOST/api/public/ledger"}";
const KEY = process.env.OPENPAY_LEDGER_KEY!;

let cursor: string | null = null;
do {
  const url = new URL(\`\${BASE}/entries\`);
  url.searchParams.set("limit", "500");
  if (cursor) url.searchParams.set("cursor", cursor);
  const res = await fetch(url, { headers: { "x-api-key": KEY } });
  const body = await res.json();
  await openledger.ingest(body.data); // push into OpenLedger / any ledger
  cursor = body.next_cursor;
} while (cursor);`;

  const curlSnippet = `curl -H "x-api-key: $OPENPAY_LEDGER_KEY" \\
  "${base || "https://YOUR_HOST/api/public/ledger"}/entries?limit=100"`;

  const entries = entriesQ.data ?? [];
  const overview = overviewQ.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Ledger API</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Every OpenPay Pro transaction is mirrored into an append-only public ledger. Issue an
            API key to sync all entries into{" "}
            <span className="font-medium text-foreground">OpenLedger</span> or any other accounting
            system.
          </p>
        </div>
        <Badge className="bg-primary/15 text-primary">
          <ScrollText className="mr-1 h-3 w-3" />
          {overview?.total_entries ?? entries.length} entries
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Ledger entries", value: String(overview?.total_entries ?? "—") },
          { label: "Wallet transactions", value: String(overview?.total_transactions ?? "—") },
          {
            label: "Missing from ledger",
            value: String(overview?.missing ?? "—"),
          },
          { label: "Latest sequence", value: String(overview?.latest_sequence ?? "—") },
        ].map((s) => (
          <Card key={s.label} className="glass-strong rounded-2xl border-border/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-1 truncate text-lg font-semibold tabular-nums">{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Coverage by type + sync */}
      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Full transaction coverage
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Mirrors send, receive, top-up (buy), sell, swap, mint & reward into the public ledger
              for OpenLedger.
            </p>
          </div>
          {isAdmin && (
            <Button
              type="button"
              className="rounded-full"
              disabled={syncM.isPending}
              onClick={() => syncM.mutate()}
            >
              {syncM.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              Sync all transactions
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["send", "receive", "buy", "sell", "swap", "mint", "reward"] as const).map((t) => (
            <Badge key={t} variant="outline" className="rounded-full capitalize">
              {t}
              {t === "buy" ? " · top-up" : ""} · {overview?.by_type?.[t] ?? 0}
            </Badge>
          ))}
        </div>
      </Card>

      {/* OpenLedger integration */}
      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Plug className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            OpenLedger integration
          </h2>
        </div>
        <ol className="mb-4 space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="font-semibold text-foreground">1.</span>
            Create an API key below (admin). Copy the secret once.
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-foreground">2.</span>
            In OpenLedger (or your ledger), set base URL to the endpoints and header{" "}
            <code className="rounded bg-muted px-1 text-xs">x-api-key</code>.
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-foreground">3.</span>
            Poll <code className="rounded bg-muted px-1 text-xs">/entries</code> with cursor or{" "}
            <code className="rounded bg-muted px-1 text-xs">since</code> to ingest all transactions.
          </li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => copyText(curlSnippet, "cURL copied")}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy cURL
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => copyText(syncSnippet, "Sync script copied")}
          >
            <BookOpen className="mr-1.5 h-3.5 w-3.5" /> Copy Node sync
          </Button>
        </div>
      </Card>

      {/* Endpoints */}
      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          API endpoints
        </h2>
        <div className="space-y-2 text-xs">
          {[
            ["GET", `${base}/entries`],
            ["GET", `${base}/entries/{id_or_sequence}`],
            ["GET", `${base}/stats`],
          ].map(([m, u]) => (
            <div key={u} className="flex items-center gap-2 rounded-xl bg-muted/40 p-2 font-mono">
              <Badge variant="outline" className="shrink-0">
                {m}
              </Badge>
              <code className="flex-1 truncate">{u}</code>
              <button
                type="button"
                onClick={() => copyText(u)}
                className="rounded p-1 hover:bg-muted"
                aria-label="Copy endpoint"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          ))}
          <p className="mt-2 text-muted-foreground">
            Auth: <code className="rounded bg-muted px-1">x-api-key: YOUR_KEY</code> or{" "}
            <code className="rounded bg-muted px-1">Authorization: Bearer YOUR_KEY</code>
          </p>
        </div>
      </Card>

      {/* API keys */}
      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              API keys
            </h2>
          </div>
          {isAdmin && (
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3 w-3" /> Admin
            </Badge>
          )}
        </div>

        {!adminQ.isLoading && !isAdmin ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-5 text-center">
            <ShieldCheck className="mx-auto mb-2 h-7 w-7 text-primary" />
            <p className="text-sm font-medium">Admin required to issue keys</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Keys unlock the public ledger API for OpenLedger and other systems. If no admin exists
              yet, claim it below.
            </p>
            <Button
              type="button"
              className="mt-3 rounded-full"
              onClick={async () => {
                try {
                  const r = await claimAdmin();
                  if (r.claimed) {
                    toast.success("You are now admin");
                    void adminQ.refetch();
                    void overviewQ.refetch();
                  } else toast.error("Admin already exists");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Claim admin
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Or ask an existing admin to create a key for your OpenLedger workspace.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="key-label">Key label</Label>
                <Input
                  id="key-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="openledger prod"
                  className="rounded-xl"
                />
              </div>
              <Button
                type="button"
                className="rounded-full"
                disabled={createM.isPending || !label.trim()}
                onClick={() => createM.mutate()}
              >
                {createM.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-4 w-4" />
                )}
                Create key
              </Button>
            </div>

            {keysQ.isLoading ? (
              <div className="grid place-items-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (keysQ.data?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No API keys yet. Create one for OpenLedger.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {(keysQ.data ?? []).map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{k.label}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            k.active
                              ? "border-success/40 text-success"
                              : "border-destructive/40 text-destructive",
                          )}
                        >
                          {k.active ? "active" : "revoked"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {k.prefix}… · scopes {(k.scopes ?? []).join(", ") || "read"}
                        {k.last_used_at
                          ? ` · last used ${new Date(k.last_used_at).toLocaleString()}`
                          : " · never used"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {k.active ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={async () => {
                            try {
                              await revokeKey({ data: { id: k.id } });
                              toast.success("Key revoked");
                              void qc.invalidateQueries({ queryKey: ["ledger-api-keys"] });
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                        >
                          <Ban className="mr-1 h-3.5 w-3.5" /> Revoke
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={async () => {
                            try {
                              await activateKey({ data: { id: k.id } });
                              toast.success("Key reactivated");
                              void qc.invalidateQueries({ queryKey: ["ledger-api-keys"] });
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Activate
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      {/* Recent entries */}
      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent ledger entries
          </h2>
          <Button asChild variant="ghost" size="sm" className="rounded-full text-xs">
            <Link to="/activity">
              Wallet history <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {TX_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
                typeFilter === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted",
              )}
            >
              {t === "buy" ? "buy · top-up" : t}
            </button>
          ))}
        </div>
        {entriesQ.isLoading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No entries yet — new transactions appear here automatically.
          </p>
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
                  <th className="py-2 text-right">OpenLedger</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-border/40">
                    <td className="py-2 font-mono tabular-nums">{e.sequence}</td>
                    <td className="py-2 capitalize">{e.type}</td>
                    <td className="py-2 font-mono">
                      {shortAddress(e.from_address)} → {shortAddress(e.to_address)}
                    </td>
                    <td className="py-2">{e.asset ?? "—"}</td>
                    <td className="py-2 text-right tabular-nums">{formatNumber(e.amount, 6)}</td>
                    <td className="py-2 text-right tabular-nums">{formatUSD(e.usd_value)}</td>
                    <td className="py-2 text-right text-muted-foreground">
                      {new Date(e.occurred_at).toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      <a
                        href={openLedgerProEntryUrl(e.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!plaintextKey} onOpenChange={(o) => !o && setPlaintextKey(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Copy your API key</DialogTitle>
            <DialogDescription>
              This secret is shown once. Store it in OpenLedger as{" "}
              <code className="text-xs">OPENPAY_LEDGER_KEY</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl bg-muted/50 p-3 font-mono text-xs break-all">
            {plaintextKey}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1 rounded-full"
              onClick={() => plaintextKey && copyText(plaintextKey, "API key copied")}
            >
              <Copy className="mr-1.5 h-4 w-4" /> Copy key
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setPlaintextKey(null)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
