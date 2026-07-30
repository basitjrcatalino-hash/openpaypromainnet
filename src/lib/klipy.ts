/**
 * KLIPY GIF / Meme client (Phantom-style picker).
 * Docs: https://docs.klipy.com — set VITE_KLIPY_API_KEY for live results.
 */

export type KlipyMediaItem = {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  kind: "gif" | "meme";
};

type KlipyTab = "gifs" | "memes";

const FALLBACK_GIFS: KlipyMediaItem[] = [
  {
    id: "fb-rocket",
    title: "Rocket",
    url: "https://media.giphy.com/media/26tPplGWjN0xLybiU/giphy.gif",
    previewUrl: "https://media.giphy.com/media/26tPplGWjN0xLybiU/200.gif",
    kind: "gif",
  },
  {
    id: "fb-pump",
    title: "Pump",
    url: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
    previewUrl: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/200.gif",
    kind: "gif",
  },
  {
    id: "fb-moon",
    title: "Moon",
    url: "https://media.giphy.com/media/l0MYt5jPRVEpTyBjS/giphy.gif",
    previewUrl: "https://media.giphy.com/media/l0MYt5jPRVEpTyBjS/200.gif",
    kind: "gif",
  },
  {
    id: "fb-dance",
    title: "Dance",
    url: "https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif",
    previewUrl: "https://media.giphy.com/media/l0HlvtIPzPdt2usKs/200.gif",
    kind: "gif",
  },
  {
    id: "fb-cash",
    title: "Cash",
    url: "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif",
    previewUrl: "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/200.gif",
    kind: "gif",
  },
  {
    id: "fb-fire",
    title: "Fire",
    url: "https://media.giphy.com/media/l0MYC0LajbuPoQ4Ne/giphy.gif",
    previewUrl: "https://media.giphy.com/media/l0MYC0LajbuPoQ4Ne/200.gif",
    kind: "gif",
  },
  {
    id: "fb-chart",
    title: "Charts",
    url: "https://media.giphy.com/media/3o6Zt6ML6BklcajjsA/giphy.gif",
    previewUrl: "https://media.giphy.com/media/3o6Zt6ML6BklcajjsA/200.gif",
    kind: "gif",
  },
  {
    id: "fb-wow",
    title: "Wow",
    url: "https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif",
    previewUrl: "https://media.giphy.com/media/5VKbvrjxpVJCM/200.gif",
    kind: "gif",
  },
];

const FALLBACK_MEMES: KlipyMediaItem[] = [
  {
    id: "fb-m-stonks",
    title: "Stonks",
    url: "https://media.giphy.com/media/YnkMcHgNIMW4Yfmjxr/giphy.gif",
    previewUrl: "https://media.giphy.com/media/YnkMcHgNIMW4Yfmjxr/200.gif",
    kind: "meme",
  },
  {
    id: "fb-m-thisisfine",
    title: "This is fine",
    url: "https://media.giphy.com/media/NTur7xlIhFLkQ/giphy.gif",
    previewUrl: "https://media.giphy.com/media/NTur7xlIhFLkQ/200.gif",
    kind: "meme",
  },
  {
    id: "fb-m-leo",
    title: "Toast",
    url: "https://media.giphy.com/media/ASd0UJjGE6uC0/giphy.gif",
    previewUrl: "https://media.giphy.com/media/ASd0UJjGE6uC0/200.gif",
    kind: "meme",
  },
  {
    id: "fb-m-doge",
    title: "Much wow",
    url: "https://media.giphy.com/media/9JJ8bA1sO2K4/giphy.gif",
    previewUrl: "https://media.giphy.com/media/9JJ8bA1sO2K4/200.gif",
    kind: "meme",
  },
  {
    id: "fb-m-ape",
    title: "Ape",
    url: "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif",
    previewUrl: "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/200.gif",
    kind: "meme",
  },
  {
    id: "fb-m-hodl",
    title: "HODL",
    url: "https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif",
    previewUrl: "https://media.giphy.com/media/l0HlBO7eyXzSZkJri/200.gif",
    kind: "meme",
  },
];

function apiKey(): string {
  return (import.meta.env.VITE_KLIPY_API_KEY as string | undefined)?.trim() ?? "";
}

function pickUrl(files: unknown): { url: string; preview: string } | null {
  if (!files || typeof files !== "object") return null;
  const f = files as Record<string, Record<string, { url?: string } | undefined> | undefined>;
  const order = ["md", "sm", "hd", "xs"] as const;
  let url = "";
  let preview = "";
  for (const size of order) {
    const slot = f[size];
    const candidate =
      slot?.gif?.url || slot?.webp?.url || slot?.mp4?.url || slot?.jpg?.url || slot?.png?.url;
    if (candidate) {
      if (!url) url = candidate;
      if (!preview) preview = candidate;
      if (size === "sm" || size === "md") preview = candidate;
    }
  }
  if (!url) return null;
  return { url, preview: preview || url };
}

function normalizeItems(raw: unknown, kind: "gif" | "meme"): KlipyMediaItem[] {
  const root = raw as {
    data?: { data?: unknown[] } | unknown[];
    result?: unknown[];
  };
  let list: unknown[] = [];
  if (Array.isArray(root?.data)) {
    list = root.data;
  } else if (root?.data && typeof root.data === "object" && Array.isArray(root.data.data)) {
    list = root.data.data;
  } else if (Array.isArray(root?.result)) {
    list = root.result;
  }

  const out: KlipyMediaItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      id?: string | number;
      title?: string;
      slug?: string;
      files?: unknown;
      file?: unknown;
      url?: string;
    };
    const picked = pickUrl(row.files ?? row.file);
    const url = picked?.url || (typeof row.url === "string" ? row.url : "");
    if (!url) continue;
    out.push({
      id: String(row.id ?? url),
      title: String(row.title || row.slug || kind.toUpperCase()),
      url,
      previewUrl: picked?.preview || url,
      kind,
    });
  }
  return out;
}

async function klipyFetch(path: string, params: Record<string, string>): Promise<unknown | null> {
  const key = apiKey();
  if (!key) return null;
  const qs = new URLSearchParams(params);
  const res = await fetch(`https://api.klipy.com/api/v1/${key}/${path}?${qs}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) return null;
  return res.json();
}

function filterFallback(items: KlipyMediaItem[], q: string): KlipyMediaItem[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((i) => i.title.toLowerCase().includes(needle) || needle.includes("btc") || needle.includes("crypto"));
}

export async function searchKlipyMedia(opts: {
  tab: KlipyTab;
  query: string;
  perPage?: number;
}): Promise<{ items: KlipyMediaItem[]; poweredByKlipy: boolean }> {
  const perPage = String(opts.perPage ?? 24);
  const q = opts.query.trim() || "crypto";
  const kind = opts.tab === "memes" ? "meme" : "gif";
  const path = opts.tab === "memes" ? "memes" : "gifs";

  try {
    const json = opts.query.trim()
      ? await klipyFetch(`${path}/search`, { q, perPage, contentFilter: "medium" })
      : await klipyFetch(`${path}/trending`, { perPage, contentFilter: "medium" });
    if (json) {
      const items = normalizeItems(json, kind);
      if (items.length) return { items, poweredByKlipy: true };
    }
  } catch {
    /* fall through */
  }

  const fallback = opts.tab === "memes" ? FALLBACK_MEMES : FALLBACK_GIFS;
  return {
    items: filterFallback(fallback, q),
    poweredByKlipy: Boolean(apiKey()),
  };
}

export function hasKlipyApiKey(): boolean {
  return Boolean(apiKey());
}
