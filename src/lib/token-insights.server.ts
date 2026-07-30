export const TOKEN_INSIGHTS_MODEL = "inclusionai/ling-3.0-flash:free";

export type TokenInsightNews = {
  headline: string;
  sentiment: "Bullish" | "Bearish" | "Neutral";
  sources: number;
};

export type TokenInsightList = {
  name: string;
  changePct: number;
};

export type TokenInsightsPayload = {
  summary: string;
  sentiment: "bullish" | "bearish" | "neutral";
  news: TokenInsightNews[];
  lists: TokenInsightList[];
  model: string;
  generatedAt: string;
  source: "openrouter" | "fallback";
};

export type TokenInsightInput = {
  name: string;
  symbol: string;
  network: string;
  category?: string | null;
  priceUsd: number;
  change24h: number;
  marketCap?: number | null;
  volume24h?: number | null;
  description?: string | null;
};

function openRouterApiKey(): string {
  return process.env.OPENROUTER_API_KEY?.trim() || "";
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(openRouterApiKey());
}

function formatCompactUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "n/a";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
}

function fallbackInsights(input: TokenInsightInput): TokenInsightsPayload {
  const up = input.change24h >= 0;
  const sentiment = up ? "bullish" : input.change24h <= -1 ? "bearish" : "neutral";
  const direction = up ? "gained" : "slipped";
  const abs = Math.abs(input.change24h).toFixed(2);
  const price =
    input.priceUsd > 0
      ? `$${input.priceUsd.toLocaleString("en-US", { maximumFractionDigits: 6 })}`
      : "its latest mark";
  const summary = `${input.name} (${input.symbol}) ${direction} ${abs}% over the last 24 hours and is trading near ${price} on ${input.network}. Market activity remains mixed — treat this as a snapshot, not financial advice.`;

  return {
    summary,
    sentiment,
    news: [
      {
        headline: `${input.symbol} ${up ? "holds support" : "faces pressure"} as traders watch the ${abs}% move`,
        sentiment: up ? "Bullish" : "Bearish",
        sources: 1,
      },
      {
        headline: `${input.network} liquidity stays in focus for ${input.name} flows`,
        sentiment: "Neutral",
        sources: 1,
      },
      {
        headline: `OpenPay Pro market snapshot: ${input.symbol} volume ${formatCompactUsd(input.volume24h)}`,
        sentiment: up ? "Bullish" : "Neutral",
        sources: 1,
      },
    ],
    lists: [
      { name: "Featured", changePct: Number((input.change24h * 0.4).toFixed(2)) },
      { name: "Top Volume", changePct: Number((Math.abs(input.change24h) + 2.5).toFixed(2)) },
      { name: "Trending", changePct: Number(input.change24h.toFixed(2)) },
      {
        name: up ? "Top Gainers" : "Top Losers",
        changePct: Number((up ? Math.abs(input.change24h) : -Math.abs(input.change24h)).toFixed(2)),
      },
    ],
    model: "fallback",
    generatedAt: new Date().toISOString(),
    source: "fallback",
  };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("Model did not return JSON");
}

function normalizeInsights(
  raw: unknown,
  input: TokenInsightInput,
): TokenInsightsPayload {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const base = fallbackInsights(input);

  const summary =
    typeof obj.summary === "string" && obj.summary.trim().length > 20
      ? obj.summary.trim().slice(0, 480)
      : base.summary;

  const sentRaw = String(obj.sentiment ?? base.sentiment).toLowerCase();
  const sentiment =
    sentRaw === "bullish" || sentRaw === "bearish" || sentRaw === "neutral"
      ? sentRaw
      : base.sentiment;

  const newsRaw = Array.isArray(obj.news) ? obj.news : [];
  const news: TokenInsightNews[] = newsRaw
    .map((item): TokenInsightNews | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const headline = typeof row.headline === "string" ? row.headline.trim() : "";
      if (!headline) return null;
      const s = String(row.sentiment ?? "Neutral");
      const sentimentLabel =
        /bull/i.test(s) ? "Bullish" : /bear/i.test(s) ? "Bearish" : "Neutral";
      const sources =
        typeof row.sources === "number" && Number.isFinite(row.sources)
          ? Math.max(1, Math.min(12, Math.round(row.sources)))
          : 1;
      return { headline: headline.slice(0, 160), sentiment: sentimentLabel, sources };
    })
    .filter((n): n is TokenInsightNews => !!n)
    .slice(0, 5);

  const listsRaw = Array.isArray(obj.lists) ? obj.lists : [];
  const lists: TokenInsightList[] = listsRaw
    .map((item): TokenInsightList | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!name) return null;
      const changePct =
        typeof row.changePct === "number" && Number.isFinite(row.changePct)
          ? Number(row.changePct.toFixed(2))
          : 0;
      return { name: name.slice(0, 32), changePct };
    })
    .filter((n): n is TokenInsightList => !!n)
    .slice(0, 4);

  return {
    summary,
    sentiment,
    news: news.length ? news : base.news,
    lists: lists.length ? lists : base.lists,
    model: TOKEN_INSIGHTS_MODEL,
    generatedAt: new Date().toISOString(),
    source: "openrouter",
  };
}

function messageText(result: unknown): string {
  if (!result || typeof result !== "object" || !("choices" in result)) return "";
  const choice = (
    result as {
      choices?: Array<{
        message?: {
          content?: string | null;
          reasoning?: string | null;
        };
      }>;
    }
  ).choices?.[0]?.message;
  if (!choice) return "";
  if (typeof choice.content === "string" && choice.content.trim()) {
    return choice.content;
  }
  if (typeof choice.reasoning === "string" && choice.reasoning.includes("{")) {
    return choice.reasoning;
  }
  return "";
}

/**
 * Phantom-style token market insight via OpenRouter REST API (no SDK).
 * Model: inclusionai/ling-3.0-flash:free
 */
export async function generateTokenInsights(
  input: TokenInsightInput,
): Promise<TokenInsightsPayload> {
  const key = openRouterApiKey();
  if (!key) return fallbackInsights(input);

  const prompt = [
    `You write Phantom-wallet style crypto market insights.`,
    `Return ONLY valid JSON (no markdown, no reasoning prose) with this shape:`,
    `{"summary":"2-3 sentences","sentiment":"bullish|bearish|neutral","news":[{"headline":"...","sentiment":"Bullish|Bearish|Neutral","sources":1}],"lists":[{"name":"Featured","changePct":-0.61},{"name":"Top Volume","changePct":12.3},{"name":"Trending","changePct":-2.1},{"name":"Top Losers","changePct":-3.8}]}`,
    `Rules:`,
    `- summary: concise, factual tone like Phantom "Generated from market insights"`,
    `- news: exactly 3 headlines about this token / its market (not financial advice)`,
    `- lists: exactly 4 related list chips with realistic changePct numbers`,
    `- Do not invent specific real news events with false dates; keep headlines plausible market commentary`,
    `- Output the JSON object as the entire answer`,
    ``,
    `Token context:`,
    `name=${input.name}`,
    `symbol=${input.symbol}`,
    `network=${input.network}`,
    `category=${input.category ?? "n/a"}`,
    `priceUsd=${input.priceUsd}`,
    `change24h=${input.change24h}%`,
    `marketCap=${formatCompactUsd(input.marketCap)}`,
    `volume24h=${formatCompactUsd(input.volume24h)}`,
    `about=${(input.description ?? "").slice(0, 280)}`,
  ].join("\n");

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.OPENROUTER_HTTP_REFERER?.trim() || "https://openpy.space",
        "X-Title": process.env.OPENROUTER_APP_TITLE?.trim() || "OpenPay Pro",
      },
      body: JSON.stringify({
        model: TOKEN_INSIGHTS_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a crypto market desk assistant for a wallet app. Respond with a single JSON object only.",
          },
          { role: "user", content: prompt },
        ],
        stream: false,
        temperature: 0.4,
        max_tokens: 1600,
        reasoning: { effort: "minimal" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[token-insights] OpenRouter HTTP", res.status, body.slice(0, 400));
      return fallbackInsights(input);
    }

    const result = (await res.json()) as unknown;
    const content = messageText(result);
    if (!content.trim()) return fallbackInsights(input);
    return normalizeInsights(extractJsonObject(content), input);
  } catch (err) {
    console.error("[token-insights]", err);
    return fallbackInsights(input);
  }
}
