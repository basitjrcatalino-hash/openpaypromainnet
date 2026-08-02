import { useEffect, useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import { PERP_MARKETS, marketToMajorId, type PerpMarket } from "@/lib/perp";
import { MAJOR_TOKENS } from "@/lib/major-tokens";
import { pairLabel, type TradeMode } from "@/lib/exchange-depth";
import { TokenAvatar } from "@/components/wallet/TokenAvatar";
import type { PerpLiveQuote } from "@/lib/tradingview-perps";
import { quoteByMarket } from "@/lib/tradingview-perps";
import type { MajorMarketSnapshot } from "@/lib/major-tokens";
import { majorMarketById } from "@/lib/major-tokens";

const FAV_KEY = "openpay_trade_favorites";

function loadFavorites(): PerpMarket[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return ["BTC", "ETH"];
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter((m): m is PerpMarket => PERP_MARKETS.includes(m as PerpMarket));
  } catch {
    return ["BTC", "ETH"];
  }
}

function saveFavorites(list: PerpMarket[]) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function TradePairSearch({
  mode,
  market,
  quotes,
  majors,
  onSelect,
}: {
  mode: TradeMode;
  market: PerpMarket;
  quotes?: PerpLiveQuote[];
  majors?: MajorMarketSnapshot[];
  onSelect: (m: PerpMarket) => void;
}) {
  const [q, setQ] = useState("");
  const [favs, setFavs] = useState<PerpMarket[]>([]);

  useEffect(() => {
    setFavs(loadFavorites());
  }, []);

  function toggleFav(m: PerpMarket) {
    setFavs((prev) => {
      const next = prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m];
      saveFavorites(next);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = [...PERP_MARKETS];
    list.sort((a, b) => {
      const af = favs.includes(a) ? 0 : 1;
      const bf = favs.includes(b) ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.localeCompare(b);
    });
    if (!needle) return list;
    return list.filter((m) => {
      const id = marketToMajorId(m);
      const d = MAJOR_TOKENS[id];
      return (
        m.toLowerCase().includes(needle) ||
        d.symbol.toLowerCase().includes(needle) ||
        d.name.toLowerCase().includes(needle) ||
        pairLabel(m, mode).toLowerCase().includes(needle)
      );
    });
  }, [q, favs, mode]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search BTC, ETH, SOL, PI…"
          className="h-10 w-full rounded-xl border border-border/50 bg-muted/40 pl-9 pr-3 text-sm outline-none ring-primary/30 focus:ring-2"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {(["Spot", "Perpetual", "Favorites"] as const).map((chip) => (
          <span
            key={chip}
            className="shrink-0 rounded-full bg-muted/50 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground"
          >
            {chip}
          </span>
        ))}
      </div>
      <ul className="max-h-[50dvh] space-y-0.5 overflow-y-auto overscroll-contain pb-2">
        {filtered.map((m) => {
          const id = marketToMajorId(m);
          const d = MAJOR_TOKENS[id];
          const s = quoteByMarket(quotes, m);
          const snap = majorMarketById(majors, id);
          const px = Number(
            s?.markPrice && s.markPrice > 0
              ? s.markPrice
              : s?.price && s.price > 0
                ? s.price
                : snap.price > 0
                  ? snap.price
                  : 0,
          );
          const ch = Number(s?.change24h ?? snap.change24h ?? 0);
          const fav = favs.includes(m);
          return (
            <li key={m}>
              <div
                className={cn(
                  "flex w-full items-center gap-2 rounded-2xl px-2 py-2.5",
                  market === m ? "bg-muted/60" : "hover:bg-muted/40",
                )}
              >
                <button
                  type="button"
                  aria-label={fav ? "Unfavorite" : "Favorite"}
                  onClick={() => toggleFav(m)}
                  className="grid h-8 w-8 shrink-0 place-items-center press"
                >
                  <Star
                    className={cn(
                      "h-4 w-4",
                      fav ? "fill-[#ffad0a] text-[#ffad0a]" : "text-muted-foreground",
                    )}
                  />
                </button>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left press"
                  onClick={() => onSelect(m)}
                >
                  <TokenAvatar logoUrl={d.logoUrl} name={d.name} symbol={d.symbol} verified />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{pairLabel(m, mode)}</span>
                    <span className="block text-[11px] text-muted-foreground">{d.name}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold tabular-nums">
                      ${formatNumber(px, px >= 1000 ? 0 : px >= 1 ? 2 : 4)}
                    </span>
                    <span
                      className={cn(
                        "block text-[11px] font-semibold tabular-nums",
                        ch >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]",
                      )}
                    >
                      {ch >= 0 ? "+" : ""}
                      {formatNumber(ch, 2)}%
                    </span>
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
