import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PERP_MARKETS } from "@/lib/perp";
import {
  fetchExchangeDepth,
  type ExchangeDepthBook,
  type TradeMode,
} from "@/lib/exchange-depth";

const DepthSchema = z.object({
  market: z.enum(PERP_MARKETS),
  mode: z.enum(["spot", "futures"]),
  mark: z.number().nonnegative().optional(),
});

export const getExchangeDepth = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DepthSchema.parse(d))
  .handler(async ({ data }): Promise<ExchangeDepthBook> => {
    return fetchExchangeDepth(data.market, data.mode as TradeMode, data.mark ?? 0);
  });
