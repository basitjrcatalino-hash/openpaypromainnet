import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, getLanguageMeta } from "@/i18n/languages";
import { localePacks } from "@/i18n/locales/packs";
import { applyDocumentLanguage, getDisplayLanguageCode } from "@/lib/language";

const resources = Object.fromEntries(
  Object.entries(localePacks).map(([code, translation]) => [code, { translation }]),
);

function initialLanguage(): string {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) return getLanguageMeta(stored).code;
  } catch {
    /* ignore */
  }
  return getDisplayLanguageCode() || DEFAULT_LANGUAGE;
}

const lng = initialLanguage();

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: Object.keys(resources),
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
  });
  applyDocumentLanguage(lng);
}

export async function changeAppLanguage(code: string) {
  const next = getLanguageMeta(code).code;
  if (i18n.language === next) return;
  await i18n.changeLanguage(next);
  applyDocumentLanguage(next);
}

export default i18n;
