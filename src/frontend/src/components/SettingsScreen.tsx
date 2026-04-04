import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Bell, DollarSign, Globe, Info, Menu, Shield } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n";
import { toast } from "sonner";
import type { Screen } from "../App";
import { CURRENCY_OPTIONS, detectCurrencyFromLocaleCode } from "../utils/format";

const LANGS = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "ur", label: "اردو" },
  { value: "ar", label: "العربية" },
];

interface Props {
  navigate: (s: Screen) => void;
  onOpenSidebar: () => void;
}

export function SettingsScreen({ navigate: _navigate, onOpenSidebar }: Props) {
  const { t, setLang } = useI18n();
  const [threshold, setThreshold] = useState(
    localStorage.getItem("threshold") || "1000",
  );
  const [inactiveDays, setInactiveDays] = useState(
    localStorage.getItem("inactiveDays") || "7",
  );
  const [reminderEnabled, setReminderEnabled] = useState(
    localStorage.getItem("reminderEnabled") === "true",
  );
  const [currency, setCurrency] = useState(
    localStorage.getItem("currencyCode") || detectCurrencyFromLocaleCode(),
  );
  const [language, setLanguage] = useState(localStorage.getItem("language") || "en");

  const handleSave = () => {
    const tValue = Number.parseFloat(threshold);
    const d = Number.parseInt(inactiveDays);
    if (Number.isNaN(tValue) || tValue < 0) {
      toast.error("Enter valid threshold");
      return;
    }
    if (Number.isNaN(d) || d < 1) {
      toast.error("Enter valid days");
      return;
    }
    localStorage.setItem("threshold", tValue.toString());
    localStorage.setItem("inactiveDays", d.toString());
    localStorage.setItem("reminderEnabled", reminderEnabled.toString());
    localStorage.setItem("currencyCode", currency);
    localStorage.setItem("language", language);
    setLang(language as "en" | "hi" | "ur" | "ar");
    toast.success(t("settings_saved"));
  };

  return (
    <div className="screen-container">
      <div className="app-header px-4 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <button
            type="button"
            data-ocid="settings.sidebar.toggle"
            onClick={onOpenSidebar}
            className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">{t("settings")}</h1>
            <p className="text-white/60 text-sm">Configure Ledger behavior</p>
          </div>
        </div>
      </div>

      <div className="scroll-area px-4 py-5 space-y-5 pb-8">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Globe size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("language")}
            </h2>
          </div>
          <div className="bg-card rounded-xl p-4">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Status Indicators
            </h2>
          </div>
          <div className="bg-card rounded-xl p-4 space-y-4">
            <div>
              <Label htmlFor="threshold">High Balance Threshold</Label>
              <Input id="threshold" value={threshold} onChange={(e) => setThreshold(e.target.value)} type="number" min="0" className="h-12 mt-1" />
            </div>
            <div>
              <Label htmlFor="inactive-days">Inactive Days Threshold</Label>
              <Input id="inactive-days" value={inactiveDays} onChange={(e) => setInactiveDays(e.target.value)} type="number" min="1" className="h-12 mt-1" />
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("currency")}</h2>
          </div>
          <div className="bg-card rounded-xl p-4">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Reminders</h2>
          </div>
          <div className="bg-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Show reminder suggestions</p>
              <Switch checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
            </div>
          </div>
        </section>

        <Button className="w-full h-12 font-semibold" onClick={handleSave}>{t("save_settings")}</Button>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">App Info</h2>
          </div>
          <div className="bg-card rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Version</span><span className="font-medium">2.0.0</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Platform</span><span className="font-medium">Node.js + SQLite</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Storage</span><span className="font-medium">Local Database</span></div>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground pb-2">© {new Date().getFullYear()} {t("app_name")}</p>
      </div>
    </div>
  );
}
