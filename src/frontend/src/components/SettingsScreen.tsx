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
import { Bell, DollarSign, Info, Menu, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Screen } from "../App";

const CURRENCIES = [
  { value: "₹", label: "₹ Indian Rupee" },
  { value: "$", label: "$ US Dollar" },
  { value: "AED", label: "AED UAE Dirham" },
  { value: "SAR", label: "SAR Saudi Riyal" },
  { value: "£", label: "£ British Pound" },
  { value: "₨", label: "₨ Pakistani Rupee" },
];

function detectDefaultCurrency(): string {
  const lang = navigator.language || "";
  if (lang.includes("-IN") || lang === "hi" || lang === "ur") return "₹";
  if (lang.includes("-PK")) return "₨";
  if (lang.includes("-AE")) return "AED";
  if (lang.includes("-SA")) return "SAR";
  if (lang.includes("-GB")) return "£";
  if (lang.includes("-US")) return "$";
  return "₹";
}

interface Props {
  navigate: (s: Screen) => void;
  onOpenSidebar: () => void;
}

export function SettingsScreen({ navigate: _navigate, onOpenSidebar }: Props) {
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
    localStorage.getItem("currencyOverride") || detectDefaultCurrency(),
  );

  const handleSave = () => {
    const t = Number.parseFloat(threshold);
    const d = Number.parseInt(inactiveDays);
    if (Number.isNaN(t) || t < 0) {
      toast.error("Enter valid threshold");
      return;
    }
    if (Number.isNaN(d) || d < 1) {
      toast.error("Enter valid days");
      return;
    }
    localStorage.setItem("threshold", t.toString());
    localStorage.setItem("inactiveDays", d.toString());
    localStorage.setItem("reminderEnabled", reminderEnabled.toString());
    localStorage.setItem("currencyOverride", currency);
    toast.success("Settings saved");
  };

  return (
    <div className="screen-container">
      {/* Header */}
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
            <h1 className="text-white text-xl font-bold">Settings</h1>
            <p className="text-white/60 text-sm">Configure app behaviour</p>
          </div>
        </div>
      </div>

      <div className="scroll-area px-4 py-5 space-y-5 pb-8">
        {/* Status thresholds */}
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
              <p className="text-xs text-muted-foreground mb-2">
                Show "High" badge when balance exceeds this amount
              </p>
              <Input
                id="threshold"
                data-ocid="settings.threshold.input"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                type="number"
                min="0"
                className="h-12"
              />
            </div>
            <div>
              <Label htmlFor="inactive-days">Inactive Days Threshold</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Show "Inactive" badge if no payment in this many days
              </p>
              <Input
                id="inactive-days"
                data-ocid="settings.inactive_days.input"
                value={inactiveDays}
                onChange={(e) => setInactiveDays(e.target.value)}
                type="number"
                min="1"
                className="h-12"
              />
            </div>
          </div>
        </section>

        {/* Currency */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Currency
            </h2>
          </div>
          <div className="bg-card rounded-xl p-4">
            <Label htmlFor="currency-select">Currency Symbol</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Used for all prices, totals, and transactions
            </p>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger
                id="currency-select"
                data-ocid="settings.currency.select"
                className="h-12"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Reminders */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Reminders
            </h2>
          </div>
          <div className="bg-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Show Reminder Suggestions</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Suggest reminders for inactive customers (no auto-send)
                </p>
              </div>
              <Switch
                data-ocid="settings.reminder.switch"
                checked={reminderEnabled}
                onCheckedChange={setReminderEnabled}
              />
            </div>
          </div>
        </section>

        {/* Save */}
        <Button
          type="button"
          data-ocid="settings.save.primary_button"
          className="w-full h-12 font-semibold"
          onClick={handleSave}
        >
          Save Settings
        </Button>

        {/* App info */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              App Info
            </h2>
          </div>
          <div className="bg-card rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium">2.0.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-medium">Internet Computer</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Storage</span>
              <span className="font-medium">On-chain (ICP)</span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-2">
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            Built with ❤️ using caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}
