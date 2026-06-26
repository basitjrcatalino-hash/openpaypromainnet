import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchAdminDashboard, type AdminDashboard } from "@/lib/piApi";

export const Route = createFileRoute("/admin/testnet-progress")({
  head: () => ({
    meta: [
      { title: "Testnet A2U Progress — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => fetchAdminDashboard().then(d => alive && setData(d)).catch(e => alive && setErr(e.message));
    void tick();
    const id = window.setInterval(tick, 15000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  if (err) return <div className="p-8 text-destructive">Error: {err}</div>;
  if (!data) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Pi Testnet A2U — Admin Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Unique wallets" value={`${data.unique_wallets_count} / ${data.progress.target}`} />
        <Stat label="Successful payments" value={data.total_successful_a2u} />
        <Stat label="Failed payments" value={data.failed_transactions.length} />
      </div>

      <Section title="Wallet addresses">
        {data.wallet_addresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No wallets yet.</p>
        ) : (
          <ul className="space-y-1 font-mono text-xs">
            {data.wallet_addresses.map(w => <li key={w} className="break-all">{w}</li>)}
          </ul>
        )}
      </Section>

      <Section title="Transactions">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="py-2">Status</th><th>UID</th><th>Amount</th><th>TXID</th><th>Wallet</th><th>When</th></tr>
            </thead>
            <tbody>
              {data.transactions.map(t => (
                <tr key={t.id} className="border-t border-border/40">
                  <td className="py-2"><span className={t.status === "success" ? "text-green-500" : t.status === "failed" ? "text-destructive" : ""}>{t.status}</span></td>
                  <td className="font-mono">{t.uid.slice(0, 10)}…</td>
                  <td>{t.amount}</td>
                  <td className="font-mono break-all">{t.txid?.slice(0, 16) || "—"}</td>
                  <td className="font-mono break-all">{t.wallet_address?.slice(0, 16) || "—"}</td>
                  <td>{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Recent diagnostic logs">
        <ul className="space-y-1 text-xs">
          {data.logs.slice(0, 50).map((l, i) => (
            <li key={i} className="flex gap-2 border-b border-border/30 py-1">
              <span className={l.level === "error" ? "text-destructive" : l.level === "warn" ? "text-yellow-500" : "text-muted-foreground"}>[{l.level}]</span>
              <span className="text-muted-foreground">{new Date(l.timestamp).toLocaleTimeString()}</span>
              <span>{l.message}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}