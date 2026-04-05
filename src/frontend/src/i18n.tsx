import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import ar from "./locales/ar.json";
import en from "./locales/en.json";
import hi from "./locales/hi.json";
import ur from "./locales/ur.json";

type Lang = "en" | "hi" | "ur" | "ar";
const resources: Record<Lang, Record<string, string>> = { en, hi, ur, ar };

const I18nContext = createContext<{
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  isRtl: boolean;
} | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const [lang, setLangState] = useState<Lang>(
    (localStorage.getItem("language") as Lang) || "en",
  );

  const setLang = (next: Lang) => {
    setLangState(next);
    localStorage.setItem("language", next);
  };

  useEffect(() => {
    const isRtl = lang === "ar" || lang === "ur";
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.title = resources[lang].app_name || "Ledger";
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: (key: string) => resources[lang][key] || resources.en[key] || key,
      isRtl: lang === "ar" || lang === "ur",
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
