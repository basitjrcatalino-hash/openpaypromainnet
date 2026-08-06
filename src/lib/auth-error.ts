/** Shared helpers for OAuth callback error UI (OpenPay / Pi / Telegram / etc.). */

export function isUselessAuthErrorText(s: string) {
  const t = s.trim();
  return (
    !t ||
    t === "0" ||
    t === "()" ||
    t === "[]" ||
    t === "{}" ||
    t === "null" ||
    t === "undefined" ||
    /^\d+$/.test(t) ||
    /^[\s()[\]]+$/.test(t)
  );
}

/**
 * Turn any thrown value / API `error` field into a human string.
 * Never return bare "0", "[]", or empty punctuation.
 */
export function cleanAuthErrorMessage(raw: unknown, fallback: string): string {
  if (raw == null) return fallback;

  if (typeof raw === "string") {
    const s = raw.trim();
    return isUselessAuthErrorText(s) ? fallback : s;
  }

  if (raw instanceof Error) {
    const s = (raw.message || "").trim();
    if (!isUselessAuthErrorText(s)) return s;
    // AuthRetryableFetchError / Failed to fetch → dead Supabase host
    if (/failed to fetch|err_name_not_resolved|networkerror|load failed/i.test(String(raw))) {
      return "Cannot reach Supabase Auth. Check VITE_SUPABASE_URL — the project host may be paused or deleted.";
    }
    return fallback;
  }

  if (Array.isArray(raw)) {
    const parts = raw
      .map((x) => cleanAuthErrorMessage(x, ""))
      .map((s) => s.trim())
      .filter((s) => s && !isUselessAuthErrorText(s));
    return parts.length ? parts.join("; ") : fallback;
  }

  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const key of ["error_description", "message", "error", "msg", "detail", "hint"]) {
      const v = o[key];
      if (v == null || v === "") continue;
      if (typeof v === "string" && !isUselessAuthErrorText(v)) return v.trim();
      if (typeof v === "object") {
        const nested = cleanAuthErrorMessage(v, "");
        if (nested && !isUselessAuthErrorText(nested)) return nested;
      }
    }
    try {
      const json = JSON.stringify(raw);
      if (json && !isUselessAuthErrorText(json) && json !== "[]" && json !== "{}") {
        return json.slice(0, 240);
      }
    } catch {
      /* ignore */
    }
  }

  const s = String(raw).trim();
  return isUselessAuthErrorText(s) ? fallback : s;
}

export function supabaseUnreachableHint(url?: string | null) {
  const host = (url || "").replace(/^https?:\/\//, "").split("/")[0] || "your Supabase project";
  return `Supabase Auth host unreachable (${host}). Restore/unpause the project in the Supabase dashboard, or update VITE_SUPABASE_URL + keys in Lovable secrets.`;
}
