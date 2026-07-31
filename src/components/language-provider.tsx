import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import "@/i18n";
import { APP_LANGUAGES, getLanguageMeta, LANGUAGE_STORAGE_KEY } from "@/i18n/languages";
import {
  applyDocumentLanguage,
  getDisplayLanguageCode,
  setDisplayLanguage,
  subscribeDisplayLanguage,
} from "@/lib/language";

function isKnown(code: string) {
  return APP_LANGUAGES.some(
    (l) => l.code === code || l.code.toLowerCase() === code.toLowerCase(),
  );
}

/** Hydrate i18n + document lang/dir from localStorage / Supabase prefs. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    const sync = () => {
      const code = getDisplayLanguageCode();
      applyDocumentLanguage(code);
      if (i18n.language !== code) void i18n.changeLanguage(code);
    };
    sync();
    return subscribeDisplayLanguage(sync);
  }, [i18n]);

  useEffect(() => {
    void (async () => {
      try {
        if (typeof window === "undefined") return;
        if (localStorage.getItem(LANGUAGE_STORAGE_KEY)) return;
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const { data } = await supabase
          .from("user_preferences")
          .select("language")
          .eq("user_id", auth.user.id)
          .maybeSingle();
        const pref = data?.language;
        if (typeof pref === "string" && isKnown(pref)) {
          setDisplayLanguage(getLanguageMeta(pref).code);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return children;
}
