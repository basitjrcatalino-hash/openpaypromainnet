import { Link } from "@tanstack/react-router";
import { formatNumber, shortAddress, timeAgo } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export type OtTradeRow = {
  id: string;
  side: "buy" | "sell" | string;
  pi_amount: number;
  token_amount: number;
  price: number;
  created_at: string;
  tx_ref?: string | null;
  user_id: string;
  profiles?: { display_name?: string | null; username?: string | null; avatar_url?: string | null } | null;
};

export function TradesTable({ trades, symbol }: { trades: OtTradeRow[]; symbol: string }) {
  if (!trades.length) {
    return <div className="py-8 text-center text-sm text-muted-foreground">No trades yet</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border/60">
            <th className="px-3 py-2 font-medium">Account</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium text-right">π</th>
            <th className="px-3 py-2 font-medium text-right">${symbol}</th>
            <th className="px-3 py-2 font-medium text-right">Time</th>
            <th className="px-3 py-2 font-medium text-right">Txn</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {trades.map((t) => {
            const name =
              t.profiles?.username || t.profiles?.display_name || shortAddress(t.user_id, 4, 4);
            return (
              <tr key={t.id} className="hover:bg-accent/30">
                <td className="px-3 py-2">
                  <Link
                    to="/opentoken/creator/$userId"
                    params={{ userId: t.user_id }}
                    className="text-xs font-medium hover:text-primary"
                  >
                    {name}
                  </Link>
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-xs font-semibold",
                    t.side === "buy" ? "text-success" : "text-destructive",
                  )}
                >
                  {t.side === "buy" ? "Buy" : "Sell"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(t.pi_amount, 4)}</td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums",
                    t.side === "buy" ? "text-success" : "text-destructive",
                  )}
                >
                  {formatNumber(t.token_amount, 2)}
                </td>
                <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                  {timeAgo(t.created_at)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[10px] text-muted-foreground">
                  {t.tx_ref ? shortAddress(t.tx_ref, 4, 4) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
