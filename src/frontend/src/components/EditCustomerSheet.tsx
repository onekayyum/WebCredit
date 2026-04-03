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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Customer } from "../backend.d";
import { useUpdateCustomer } from "../hooks/useQueries";

const COUNTRY_CODES = [
  { code: "91", label: "🇮🇳 India +91" },
  { code: "92", label: "🇵🇰 Pakistan +92" },
  { code: "966", label: "🇸🇦 Saudi +966" },
  { code: "971", label: "🇦🇪 UAE +971" },
  { code: "44", label: "🇬🇧 UK +44" },
  { code: "1", label: "🇺🇸 USA +1" },
];

function detectCountryCode(): string {
  const lang = navigator.language || "";
  if (lang.includes("-IN") || lang === "hi" || lang === "ur") return "91";
  if (lang.includes("-PK")) return "92";
  if (lang.includes("-AE")) return "971";
  if (lang.includes("-SA")) return "966";
  if (lang.includes("-GB")) return "44";
  if (lang.includes("-US")) return "1";
  return "91";
}

function parseMobile(mobile: string): { countryCode: string; local: string } {
  if (!mobile.startsWith("+")) {
    return { countryCode: detectCountryCode(), local: mobile };
  }
  const withoutPlus = mobile.slice(1);
  // Try longest codes first to avoid ambiguity
  const codes = ["966", "971", "92", "91", "44", "1"];
  for (const code of codes) {
    if (withoutPlus.startsWith(code)) {
      return { countryCode: code, local: withoutPlus.slice(code.length) };
    }
  }
  return { countryCode: detectCountryCode(), local: mobile };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: Customer;
}

export function EditCustomerSheet({ open, onOpenChange, customer }: Props) {
  const parsed = parseMobile(customer.mobile);
  const [name, setName] = useState(customer.name);
  const [countryCode, setCountryCode] = useState(parsed.countryCode);
  const [localNumber, setLocalNumber] = useState(parsed.local);
  const [errors, setErrors] = useState<{ name?: string; mobile?: string }>({});
  const updateCustomer = useUpdateCustomer();

  useEffect(() => {
    const p = parseMobile(customer.mobile);
    setName(customer.name);
    setCountryCode(p.countryCode);
    setLocalNumber(p.local);
  }, [customer]);

  const validate = () => {
    const e: { name?: string; mobile?: string } = {};
    if (!name.trim()) e.name = "Name is required";
    if (!/^\d{7,12}$/.test(localNumber))
      e.mobile = "Enter a valid local number (7–12 digits)";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const mobile = `+${countryCode}${localNumber}`;
    const ok = await updateCustomer.mutateAsync({
      id: customer.id,
      name: name.trim(),
      mobile,
    });
    if (ok) {
      toast.success("Customer updated");
      onOpenChange(false);
    } else {
      toast.error("Update failed");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl px-5 pb-8"
        data-ocid="edit_customer.sheet"
      >
        <SheetHeader className="mb-5">
          <SheetTitle>Edit Customer</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              data-ocid="edit_customer.name.input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-12"
            />
            {errors.name && (
              <p className="text-destructive text-xs mt-1">{errors.name}</p>
            )}
          </div>
          <div>
            <Label>Mobile *</Label>
            <div className="flex gap-2 mt-1">
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger
                  data-ocid="edit_customer.country_code.select"
                  className="w-36 h-12 flex-shrink-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                data-ocid="edit_customer.mobile.input"
                value={localNumber}
                onChange={(e) =>
                  setLocalNumber(e.target.value.replace(/\D/g, ""))
                }
                type="tel"
                inputMode="numeric"
                className="flex-1 h-12"
              />
            </div>
            {errors.mobile && (
              <p className="text-destructive text-xs mt-1">{errors.mobile}</p>
            )}
            <p className="text-muted-foreground text-xs mt-1">
              Stored as: +{countryCode}
              {localNumber}
            </p>
          </div>
          <Button
            data-ocid="edit_customer.save_button"
            className="w-full h-12 font-semibold"
            onClick={handleSave}
            disabled={updateCustomer.isPending}
          >
            {updateCustomer.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {updateCustomer.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
