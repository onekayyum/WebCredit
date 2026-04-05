import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useI18n } from "../i18n";
import { CURRENCY_OPTIONS, detectCurrencyFromLocaleCode } from "../utils/format";

const LANGS = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "ur", label: "اردو" },
  { value: "ar", label: "العربية" },
] as const;

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { t, setLang } = useI18n();
  const [step, setStep] = useState(1);
  const [language, setLanguage] = useState(localStorage.getItem("language") || "en");
  const [currency, setCurrency] = useState(localStorage.getItem("currencyCode") || detectCurrencyFromLocaleCode());
  const [businessName, setBusinessName] = useState(localStorage.getItem("businessName") || "");

  const complete = () => {
    localStorage.setItem("language", language);
    localStorage.setItem("currencyCode", currency);
    localStorage.setItem("businessName", businessName.trim());
    localStorage.setItem("onboardingDone", "true");
    onDone();
  };

  return (
    <div className="h-full flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 space-y-4">
        {step === 1 && (
          <>
            <h1 className="text-xl font-semibold">{t("welcome_title")}</h1>
            <p className="text-sm text-muted-foreground">{t("welcome_subtitle")}</p>
            <Button className="w-full" onClick={() => setStep(2)}>{t("get_started")}</Button>
          </>
        )}
        {step === 2 && (
          <>
            <Label>{t("language")}</Label>
            <select
              className="w-full h-11 rounded-md border border-input bg-background px-3"
              value={language}
              onChange={(e) => {
                const l = e.target.value;
                setLanguage(l);
                setLang(l as "en" | "hi" | "ur" | "ar");
              }}
            >
              {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <Button className="w-full" onClick={() => setStep(3)}>{t("continue")}</Button>
          </>
        )}
        {step === 3 && (
          <>
            <Label>{t("currency")}</Label>
            <select
              className="w-full h-11 rounded-md border border-input bg-background px-3"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            <Button className="w-full" onClick={() => setStep(4)}>{t("continue")}</Button>
          </>
        )}
        {step === 4 && (
          <>
            <Label>{t("business_name")}</Label>
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            <Button className="w-full" onClick={complete}>{t("finish_setup")}</Button>
          </>
        )}
      </div>
    </div>
  );
}
