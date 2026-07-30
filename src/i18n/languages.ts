/** Phantom-style display languages for OpenPay Pro. */
export type AppLanguage = {
  /** BCP-47 / i18next code stored in user_preferences.language */
  code: string;
  /** Native display name (as shown in Phantom) */
  nativeName: string;
  /** English label for search */
  englishName: string;
  /** RTL layout */
  dir?: "ltr" | "rtl";
};

export const APP_LANGUAGES: AppLanguage[] = [
  { code: "en", nativeName: "English", englishName: "English" },
  { code: "es", nativeName: "Español", englishName: "Spanish" },
  { code: "de", nativeName: "Deutsch", englishName: "German" },
  { code: "fr", nativeName: "Français", englishName: "French" },
  { code: "it", nativeName: "Italiano", englishName: "Italian" },
  { code: "zh-CN", nativeName: "中文 (简体)", englishName: "Chinese Simplified" },
  { code: "zh-TW", nativeName: "中文 (繁體)", englishName: "Chinese Traditional" },
  { code: "bn", nativeName: "বাংলা", englishName: "Bengali" },
  { code: "ja", nativeName: "日本語", englishName: "Japanese" },
  { code: "ko", nativeName: "한국어", englishName: "Korean" },
  { code: "ru", nativeName: "Русский", englishName: "Russian" },
  { code: "hi", nativeName: "हिंदी", englishName: "Hindi" },
  { code: "id", nativeName: "Indonesia", englishName: "Indonesian" },
  { code: "ms", nativeName: "Melayu", englishName: "Malay" },
  { code: "th", nativeName: "ไทย", englishName: "Thai" },
  { code: "vi", nativeName: "Tiếng Việt", englishName: "Vietnamese" },
  { code: "pt", nativeName: "Português", englishName: "Portuguese" },
  { code: "tr", nativeName: "Türkçe", englishName: "Turkish" },
  { code: "fil", nativeName: "Filipino", englishName: "Filipino" },
  { code: "my", nativeName: "မြန်မာဘာသာ", englishName: "Burmese" },
  { code: "am", nativeName: "አማርኛ", englishName: "Amharic" },
  { code: "ar", nativeName: "العربية", englishName: "Arabic", dir: "rtl" },
  { code: "gu", nativeName: "ગુજરાતી", englishName: "Gujarati" },
  { code: "ha", nativeName: "Hausa", englishName: "Hausa" },
  { code: "ig", nativeName: "Ásùsú Ìgbò", englishName: "Igbo" },
  { code: "pa", nativeName: "ਪੰਜਾਬੀ", englishName: "Punjabi" },
  { code: "sw", nativeName: "Kiswahili", englishName: "Swahili" },
  { code: "ta", nativeName: "தமிழ்", englishName: "Tamil" },
  { code: "te", nativeName: "తెలుగు", englishName: "Telugu" },
  { code: "yo", nativeName: "Èdè Yorùbá", englishName: "Yoruba" },
];

export const DEFAULT_LANGUAGE = "en";
export const LANGUAGE_STORAGE_KEY = "openpay_pro_language";

export function getLanguageMeta(code: string | null | undefined): AppLanguage {
  const c = String(code || DEFAULT_LANGUAGE).trim();
  return (
    APP_LANGUAGES.find((l) => l.code === c || l.code.toLowerCase() === c.toLowerCase()) ||
    APP_LANGUAGES[0]!
  );
}

export function isRtlLanguage(code: string | null | undefined): boolean {
  return getLanguageMeta(code).dir === "rtl";
}
