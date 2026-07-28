/** Normalize user-entered social / website values into absolute https URLs. */

function trimInput(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

function withHttps(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export function websiteHref(raw: string | null | undefined): string | null {
  const v = trimInput(raw);
  if (!v) return null;
  return withHttps(v);
}

export function twitterHref(raw: string | null | undefined): string | null {
  const v = trimInput(raw);
  if (!v) return null;
  if (/^https?:\/\//i.test(v) || /^(x|twitter)\.com\//i.test(v)) {
    return withHttps(v.replace(/^twitter\.com/i, "x.com"));
  }
  const handle = v.replace(/^@/, "");
  if (!handle) return null;
  return `https://x.com/${encodeURIComponent(handle)}`;
}

export function telegramHref(raw: string | null | undefined): string | null {
  const v = trimInput(raw);
  if (!v) return null;
  if (/^https?:\/\//i.test(v) || /^t\.me\//i.test(v)) return withHttps(v);
  const handle = v.replace(/^@/, "");
  if (!handle) return null;
  return `https://t.me/${encodeURIComponent(handle)}`;
}

export function discordHref(raw: string | null | undefined): string | null {
  const v = trimInput(raw);
  if (!v) return null;
  if (/^https?:\/\//i.test(v) || /^(discord\.(gg|com)|discordapp\.com)\//i.test(v)) {
    return withHttps(v);
  }
  return withHttps(v.includes("/") ? v : `discord.gg/${v}`);
}
