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
import { useState } from "react";
import { toast } from "sonner";
import { useAddCustomer } from "../hooks/useQueries";

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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AddCustomerSheet({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState(detectCountryCode);
  const [localNumber, setLocalNumber] = useState("");
  const [errors, setErrors] = useState<{ name?: string; mobile?: string }>({});
  const addCustomer = useAddCustomer();

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
    const result = await addCustomer.mutateAsync({ name: name.trim(), mobile });
    if (result) {
      toast.success("Customer added!");
      setName("");
      setLocalNumber("");
      setCountryCode(detectCountryCode());
      setErrors({});
      onOpenChange(false);
    } else {
      toast.error("Mobile number already exists");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl px-5 pb-8"
        data-ocid="add_customer.sheet"
      >
        <SheetHeader className="mb-5">
          <SheetTitle>Add Customer</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="cust-name">Name *</Label>
            <Input
              id="cust-name"
              data-ocid="add_customer.name.input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
              className="mt-1 h-12"
            />
            {errors.name && (
              <p
                data-ocid="add_customer.name.error_state"
                className="text-destructive text-xs mt-1"
              >
                {errors.name}
              </p>
            )}
          </div>
          <div>
            <Label>Mobile Number *</Label>
            <div className="flex gap-2 mt-1">
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger
                  data-ocid="add_customer.country_code.select"
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
                data-ocid="add_customer.mobile.input"
                value={localNumber}
                onChange={(e) =>
                  setLocalNumber(e.target.value.replace(/\D/g, ""))
                }
                placeholder="Local number"
                type="tel"
                inputMode="numeric"
                className="flex-1 h-12"
              />
            </div>
            {errors.mobile && (
              <p
                data-ocid="add_customer.mobile.error_state"
                className="text-destructive text-xs mt-1"
              >
                {errors.mobile}
              </p>
            )}
            <p className="text-muted-foreground text-xs mt-1">
              Stored as: +{countryCode}
              {localNumber || "XXXXXXXXXX"}
            </p>
          </div>
          <Button
            data-ocid="add_customer.submit_button"
            className="w-full h-12 font-semibold text-base"
            onClick={handleSave}
            disabled={addCustomer.isPending}
          >
            {addCustomer.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {addCustomer.isPending ? "Saving…" : "Save Customer"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
