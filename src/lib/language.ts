import { useCallback, useSyncExternalStore } from "react";
import {
  APP_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getLanguageMeta,
  isRtlLanguage,
} from "@/i18n/languages";

let languageCode = DEFAULT_LANGUAGE;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function isKnownLanguage(code: string): boolean {
  return APP_LANGUAGES.some(
    (l) => l.code === code || l.code.toLowerCase() === code.toLowerCase(),
  );
}

function normalizeLanguage(code: string): string {
  const meta = getLanguageMeta(code);
  return meta.code;
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (raw && isKnownLanguage(raw)) languageCode = normalizeLanguage(raw);
  } catch {
    /* ignore */
  }
}

export function getDisplayLanguageCode(): string {
  ensureHydrated();
  return languageCode;
}

export function applyDocumentLanguage(code: string) {
  if (typeof document === "undefined") return;
  const meta = getLanguageMeta(code);
  document.documentElement.lang = meta.code;
  document.documentElement.dir = isRtlLanguage(meta.code) ? "rtl" : "ltr";
}

export function setDisplayLanguage(next: string) {
  if (!isKnownLanguage(next)) return;
  ensureHydrated();
  const code = normalizeLanguage(next);
  if (languageCode === code) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
    applyDocumentLanguage(code);
    return;
  }
  languageCode = code;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
  applyDocumentLanguage(code);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("op:language-change", { detail: code }));
  }
  emit();
  void persistLanguagePreference(code);
  void import("@/i18n").then(({ changeAppLanguage }) => changeAppLanguage(code));
}

async function persistLanguagePreference(code: string) {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    await supabase.from("user_preferences").upsert(
      {
        user_id: userId,
        language: code,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  } catch {
    /* best-effort */
  }
}

export function subscribeDisplayLanguage(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function useLanguage() {
  const code = useSyncExternalStore(
    subscribeDisplayLanguage,
    getDisplayLanguageCode,
    () => DEFAULT_LANGUAGE,
  );

  const setCode = useCallback((next: string) => {
    setDisplayLanguage(next);
  }, []);

  return { code, setCode, meta: getLanguageMeta(code) };
}
