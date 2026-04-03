import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, Printer, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Customer } from "../backend.d";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: Customer;
}

declare global {
  interface Window {
    JsBarcode?: (
      el: SVGSVGElement | string,
      value: string,
      options?: Record<string, unknown>,
    ) => void;
  }
}

function loadJsBarcode(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.JsBarcode) {
      resolve();
      return;
    }
    const existing = document.getElementById("jsbarcode-cdn");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.id = "jsbarcode-cdn";
    script.src =
      "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load JsBarcode"));
    document.head.appendChild(script);
  });
}

export function CustomerBarcodeSheet({ open, onOpenChange, customer }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const barcodeValue = customer.id.toString().padStart(10, "0");

  useEffect(() => {
    if (!open) return;
    setReady(false);
    setLoadError(false);
    loadJsBarcode()
      .then(() => setReady(true))
      .catch(() => setLoadError(true));
  }, [open]);

  useEffect(() => {
    if (!ready || !svgRef.current || !window.JsBarcode) return;
    try {
      window.JsBarcode(svgRef.current, barcodeValue, {
        format: "CODE128",
        displayValue: true,
        fontSize: 14,
        height: 60,
        margin: 10,
      });
    } catch (_e) {
      setLoadError(true);
    }
  }, [ready, barcodeValue]);

  const handlePrint = () => {
    if (!svgRef.current) return;
    const svgContent = svgRef.current.outerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Customer Barcode - ${customer.name}</title>
          <style>
            body {
              margin: 0; padding: 20px;
              display: flex; flex-direction: column;
              align-items: center; justify-content: center;
              min-height: 100vh; background: #fff;
              font-family: sans-serif;
            }
            h2 { margin: 0 0 8px; font-size: 18px; color: #111; }
            p { margin: 0 0 16px; font-size: 12px; color: #666; }
            svg { max-width: 300px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h2>${customer.name}</h2>
          <p>Customer ID: ${barcodeValue}</p>
          ${svgContent}
          <p style="margin-top: 12px; font-size: 11px; color: #999;">Printed: ${new Date().toLocaleDateString()}</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl px-5 pb-8"
        data-ocid="barcode.sheet"
      >
        <SheetHeader className="mb-5">
          <SheetTitle>Customer Barcode</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="font-semibold text-foreground text-base">
              {customer.name}
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">
              ID: {barcodeValue}
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-border w-full flex justify-center">
            {!ready && !loadError && (
              <div
                data-ocid="barcode.loading_state"
                className="flex items-center gap-2 py-8 text-muted-foreground"
              >
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Loading barcode…</span>
              </div>
            )}
            {loadError && (
              <div
                data-ocid="barcode.error_state"
                className="py-8 text-center text-destructive text-sm"
              >
                Failed to load barcode library. Check internet connection.
              </div>
            )}
            <svg
              ref={svgRef}
              style={{ display: ready && !loadError ? "block" : "none" }}
            />
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Print this barcode and give it to the customer. Scan it to open
            their profile instantly.
          </p>

          <div className="flex gap-3 w-full">
            <button
              type="button"
              data-ocid="barcode.print_button"
              onClick={handlePrint}
              disabled={!ready || loadError}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--slate-dark)" }}
            >
              <Printer size={18} />
              Print Barcode
            </button>
            <button
              type="button"
              data-ocid="barcode.close_button"
              onClick={() => onOpenChange(false)}
              className="w-12 h-12 rounded-xl border border-border flex items-center justify-center text-muted-foreground"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
