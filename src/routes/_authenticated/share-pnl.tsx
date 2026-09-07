import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SharePnlPage, type SharePnl } from "@/components/trade/SharePnlDialog";

const searchSchema = z.object({
  market: z.string().catch("BTC"),
  side: z.string().catch("trade"),
  leverage: z.coerce.number().optional(),
  entryPrice: z.coerce.number().optional(),
  markPrice: z.coerce.number().optional(),
  pnl: z.coerce.number().optional(),
  pnlPct: z.coerce.number().optional(),
  amount: z.coerce.number().optional(),
  quote: z.string().catch("OUSD"),
  mode: z.enum(["spot", "futures"]).catch("spot"),
  at: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/share-pnl")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Share Trading PnL — OpenPay Pro" },
      {
        name: "description",
        content: "Create, save, and share an OpenPay Pro trading PnL card.",
      },
      { property: "og:title", content: "Share Trading PnL — OpenPay Pro" },
      {
        property: "og:description",
        content: "Create, save, and share an OpenPay Pro trading PnL card.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShareTradingPnlRoute,
});

function ShareTradingPnlRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const data: SharePnl = search;

  return (
    <SharePnlPage
      data={data}
      onBack={() => {
        void navigate({
          to: "/trade",
          search: { market: data.market, mode: data.mode },
        });
      }}
    />
  );
}