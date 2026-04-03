import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Product } from "../backend.d";
import { useCamera } from "../camera/useCamera";
import { useCSVProducts } from "../hooks/useCSVProducts";
import {
  useAddBatchTransaction,
  useAddProduct,
  useAllProducts,
  useCustomerBalance,
} from "../hooks/useQueries";
import { formatCurrency } from "../utils/format";

interface SessionItem {
  barcode: string;
  name: string;
  price: number;
  qty: number;
}

interface Props {
  customerId: bigint;
  customerName: string;
  customerMobile: string;
  onClose: () => void;
  onSaved: () => void;
}

function loadSession(customerId: bigint): SessionItem[] {
  try {
    const raw = localStorage.getItem(`batchSession_${customerId.toString()}`);
    if (raw) return JSON.parse(raw) as SessionItem[];
  } catch (_e) {
    /* ignore */
  }
  return [];
}

function saveSession(customerId: bigint, items: SessionItem[]) {
  localStorage.setItem(
    `batchSession_${customerId.toString()}`,
    JSON.stringify(items),
  );
}

function clearSession(customerId: bigint) {
  localStorage.removeItem(`batchSession_${customerId.toString()}`);
}

function csvToProduct(csv: {
  name: string;
  price: number;
  barcode: string;
}): Product {
  return {
    id: 0n,
    name: csv.name,
    price: csv.price,
    barcode: csv.barcode,
    createdAt: 0n,
  };
}

// WhatsApp receipt generator
function buildWhatsAppMessage(
  customerName: string,
  items: SessionItem[],
  total: number,
  remainingBalance: number,
  currencySymbol: string,
): string {
  const date = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const lines = [
    "*Udhaar Receipt*",
    `Customer: ${customerName}`,
    `Date: ${date}`,
    "",
    "*Items:*",
    ...items.map(
      (i) =>
        `• ${i.name} × ${i.qty} = ${currencySymbol}${(i.price * i.qty).toFixed(2)}`,
    ),
    "",
    `*Total Added: ${currencySymbol}${total.toFixed(2)}*`,
    `Remaining Balance: ${currencySymbol}${remainingBalance.toFixed(2)}`,
  ];
  return lines.join("\n");
}

function openWhatsApp(mobile: string, message: string) {
  // Strip non-digits and leading zeros; keep '+' for country code
  const cleaned = mobile.replace(/\s+/g, "");
  const num = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${num}?text=${encoded}`, "_blank");
}

export function BatchUdhaarScreen({
  customerId,
  customerName,
  customerMobile,
  onClose,
  onSaved,
}: Props) {
  const [items, setItems] = useState<SessionItem[]>(() =>
    loadSession(customerId),
  );
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [scanReady, setScanReady] = useState(true);
  const [addManuallyOpen, setAddManuallyOpen] = useState(false);
  const [addManuallyForm, setAddManuallyForm] = useState({
    barcode: "",
    name: "",
    price: "",
  });
  const [addManuallyLoading, setAddManuallyLoading] = useState(false);

  // WhatsApp prompt state
  const [whatsappPrompt, setWhatsappPrompt] = useState<{
    show: boolean;
    savedItems: SessionItem[];
    savedTotal: number;
  } | null>(null);
  // Phone prompt when no mobile on file
  const [addPhonePrompt, setAddPhonePrompt] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [resolvedMobile, setResolvedMobile] = useState(customerMobile);

  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastScanRef = useRef<{ barcode: string; unlocksAt: number } | null>(
    null,
  );

  const { data: allProducts } = useAllProducts();
  const { csvProducts } = useCSVProducts();
  const addBatchTx = useAddBatchTransaction();
  const addProductMutation = useAddProduct();
  const { data: balanceSummary } = useCustomerBalance(customerId);

  const currencySymbol =
    localStorage.getItem("currencySymbol") ||
    (navigator.language.startsWith("ar") ? "د.إ" : "₹");

  const {
    isActive,
    isLoading: camLoading,
    error: camError,
    startCamera,
    stopCamera,
    videoRef,
    canvasRef,
    isSupported,
  } = useCamera({ facingMode: "environment", width: 640, height: 480 });

  // Keep resolvedMobile in sync if prop changes
  useEffect(() => {
    setResolvedMobile(customerMobile);
  }, [customerMobile]);

  // Persist session on change
  useEffect(() => {
    saveSession(customerId, items);
  }, [items, customerId]);

  const addOrIncrement = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.barcode === product.barcode);
      if (existing) {
        return prev.map((i) =>
          i.barcode === product.barcode ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          barcode: product.barcode,
          name: product.name,
          price: product.price,
          qty: 1,
        },
      ];
    });
  }, []);

  const openAddManually = useCallback((barcode: string) => {
    setAddManuallyForm({ barcode, name: "", price: "" });
    setAddManuallyOpen(true);
  }, []);

  // BarcodeDetector scanning loop
  useEffect(() => {
    if (scannerOpen && isActive) {
      const BarcodeDetectorAPI = (window as any).BarcodeDetector;
      if (!BarcodeDetectorAPI) return;
      const detector = new BarcodeDetectorAPI({
        formats: [
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "code_128",
          "code_39",
          "qr_code",
        ],
      });
      scanIntervalRef.current = setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            const barcode = barcodes[0].rawValue as string;

            // Cooldown check — same barcode within 2s → ignore
            const now = Date.now();
            if (
              lastScanRef.current?.barcode === barcode &&
              now < lastScanRef.current.unlocksAt
            ) {
              return;
            }

            const found =
              allProducts?.find((p) => p.barcode === barcode) ??
              (csvProducts.find((p) => p.barcode === barcode)
                ? csvToProduct(csvProducts.find((p) => p.barcode === barcode)!)
                : undefined);

            if (found) {
              addOrIncrement(found);
              toast.success(`Added: ${found.name}`, { duration: 1000 });
              lastScanRef.current = { barcode, unlocksAt: now + 2000 };
              setScanReady(false);
              setTimeout(() => setScanReady(true), 2000);
            } else {
              // Non-blocking bottom toast — tapping opens add manually
              toast("Product not found. Tap to add.", {
                duration: 3000,
                action: {
                  label: "Add",
                  onClick: () => openAddManually(barcode),
                },
              });
              // Cooldown so same not-found barcode doesn't spam
              lastScanRef.current = { barcode, unlocksAt: now + 2000 };
            }
          }
        } catch (_e) {
          /* silent */
        }
      }, 800);
      return () => {
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      };
    }
  }, [
    scannerOpen,
    isActive,
    videoRef,
    allProducts,
    csvProducts,
    addOrIncrement,
    openAddManually,
  ]);

  const openScanner = async () => {
    setScannerOpen(true);
    await startCamera();
  };

  const closeScanner = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    stopCamera();
    setScannerOpen(false);
  };

  const adjustQty = (barcode: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.barcode === barcode ? { ...i, qty: Math.max(1, i.qty + delta) } : i,
        )
        .filter((i) => i.qty > 0),
    );
  };

  const setQty = (barcode: string, val: string) => {
    const n = Number.parseInt(val);
    if (Number.isNaN(n) || n < 1) return;
    setItems((prev) =>
      prev.map((i) => (i.barcode === barcode ? { ...i, qty: n } : i)),
    );
  };

  const removeItem = (barcode: string) => {
    setItems((prev) => prev.filter((i) => i.barcode !== barcode));
  };

  const handleManualAdd = () => {
    const bc = manualBarcode.trim();
    if (!bc) return;
    const backendFound = allProducts?.find((p) => p.barcode === bc);
    if (backendFound) {
      addOrIncrement(backendFound);
      setManualBarcode("");
      return;
    }
    const csvFound = csvProducts.find((p) => p.barcode === bc);
    if (csvFound) {
      addOrIncrement(csvToProduct(csvFound));
      setManualBarcode("");
    } else {
      openAddManually(bc);
      setManualBarcode("");
    }
  };

  const handleSaveManually = async () => {
    const { barcode, name, price } = addManuallyForm;
    if (!name.trim()) {
      toast.error("Product name is required");
      return;
    }
    const parsedPrice = Number.parseFloat(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Enter a valid price");
      return;
    }
    setAddManuallyLoading(true);
    try {
      const result = await addProductMutation.mutateAsync({
        name: name.trim(),
        price: parsedPrice,
        barcode: barcode.trim(),
      });
      if (result) {
        addOrIncrement(result);
        toast.success(`"${name.trim()}" added to batch & saved to products`);
      } else {
        const tempProduct: Product = {
          id: 0n,
          name: name.trim(),
          price: parsedPrice,
          barcode: barcode.trim(),
          createdAt: 0n,
        };
        addOrIncrement(tempProduct);
        toast.warning("Barcode already in database — added to batch only");
      }
      setAddManuallyOpen(false);
    } catch (_e) {
      toast.error("Failed to save product");
    } finally {
      setAddManuallyLoading(false);
    }
  };

  const dismissSheet = () => {
    if (!addManuallyLoading) setAddManuallyOpen(false);
  };

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  const handleSaveAll = async () => {
    if (items.length === 0) {
      toast.error("No items to save");
      return;
    }
    const snapshot = [...items];
    const snapshotTotal = total;
    const itemsPayload = snapshot.map((i) => ({
      name: i.name,
      price: i.price,
      qty: i.qty,
      barcode: i.barcode,
      subtotal: i.price * i.qty,
    }));
    const result = await addBatchTx.mutateAsync({
      customerId,
      totalAmount: snapshotTotal,
      itemsJson: JSON.stringify(itemsPayload),
      note: "",
    });
    if (result) {
      clearSession(customerId);
      toast.success(`Udhaar saved — ${formatCurrency(snapshotTotal)}`);
      // Show WhatsApp prompt
      setWhatsappPrompt({
        show: true,
        savedItems: snapshot,
        savedTotal: snapshotTotal,
      });
    } else {
      toast.error("Failed to save udhaar");
    }
  };

  // Handle WhatsApp Yes
  const handleWhatsAppYes = () => {
    if (!resolvedMobile) {
      // No phone — ask to add
      setAddPhonePrompt(true);
    } else {
      sendWhatsApp(resolvedMobile);
    }
  };

  const sendWhatsApp = (mobile: string) => {
    if (!whatsappPrompt) return;
    const balance = balanceSummary
      ? balanceSummary.remainingBalance
      : whatsappPrompt.savedTotal;
    const message = buildWhatsAppMessage(
      customerName,
      whatsappPrompt.savedItems,
      whatsappPrompt.savedTotal,
      balance,
      currencySymbol,
    );
    openWhatsApp(mobile, message);
    setWhatsappPrompt(null);
    onSaved();
  };

  const handleWhatsAppNo = () => {
    setWhatsappPrompt(null);
    onSaved();
  };

  const handleSavePhone = async () => {
    const trimmed = phoneInput.trim();
    if (!trimmed) return;
    setPhoneSaving(true);
    try {
      // We optimistically resolve so WhatsApp can open even if update lags
      setResolvedMobile(trimmed);
      setAddPhonePrompt(false);
      sendWhatsApp(trimmed);
    } finally {
      setPhoneSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex flex-col"
      data-ocid="batch_udhaar.panel"
    >
      {/* Header */}
      <div className="app-header px-4 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-ocid="batch_udhaar.back.button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 -ml-1"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-base leading-tight truncate">
              Batch Udhaar
            </h1>
            <p className="text-white/60 text-xs truncate">{customerName}</p>
          </div>
          {isSupported !== false && (
            <button
              type="button"
              data-ocid="batch_udhaar.scan.button"
              onClick={scannerOpen ? closeScanner : openScanner}
              className="bg-white/15 text-white rounded-lg p-2"
            >
              {scannerOpen ? <CameraOff size={20} /> : <Camera size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* Scanner panel */}
      {scannerOpen && (
        <div className="relative bg-black" style={{ height: 220 }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-44 h-28 border-2 border-white/60 rounded-lg relative">
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary/80 animate-pulse" />
            </div>
          </div>
          {camLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="text-white animate-spin" size={32} />
            </div>
          )}
          {camError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <p className="text-white text-sm text-center px-4">
                {camError.message}
              </p>
            </div>
          )}
          {isActive && !camError && (
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                {scanReady ? "Scanning… point at barcode" : "⏳ Ready to scan…"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {items.length === 0 && (
          <div
            data-ocid="batch_udhaar.empty_state"
            className="flex flex-col items-center justify-center py-20 gap-4 text-center"
          >
            <ScanLine size={52} className="text-muted-foreground/40" />
            <div>
              <p className="text-muted-foreground font-medium">
                Scan a product to begin
              </p>
              <p className="text-muted-foreground/60 text-sm mt-1">
                Tap the camera icon above or enter barcode below
              </p>
            </div>
          </div>
        )}

        {items.map((item, idx) => (
          <div
            key={item.barcode}
            data-ocid={`batch_udhaar.item.${idx + 1}`}
            className="bg-card rounded-xl p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">
                  {item.name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatCurrency(item.price)} each
                </p>
              </div>
              <button
                type="button"
                data-ocid={`batch_udhaar.delete_button.${idx + 1}`}
                onClick={() => removeItem(item.barcode)}
                className="text-muted-foreground hover:text-destructive p-1 flex-shrink-0"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-ocid={`batch_udhaar.qty_minus.${idx + 1}`}
                  onClick={() => adjustQty(item.barcode, -1)}
                  className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center active:bg-muted-foreground/20"
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min="1"
                  value={item.qty}
                  onChange={(e) => setQty(item.barcode, e.target.value)}
                  className="w-12 h-9 text-center text-sm font-bold bg-muted rounded-lg border-0 outline-none"
                />
                <button
                  type="button"
                  data-ocid={`batch_udhaar.qty_plus.${idx + 1}`}
                  onClick={() => adjustQty(item.barcode, 1)}
                  className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center active:bg-muted-foreground/20"
                >
                  <Plus size={14} />
                </button>
              </div>
              <span className="font-bold text-sm text-foreground">
                {formatCurrency(item.price * item.qty)}
              </span>
            </div>
          </div>
        ))}

        {/* Manual barcode entry */}
        <div className="flex gap-2 pt-2 pb-4">
          <Input
            data-ocid="batch_udhaar.barcode.input"
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
            placeholder="Enter barcode manually…"
            className="flex-1 h-11"
          />
          <Button
            type="button"
            data-ocid="batch_udhaar.manual_add.button"
            variant="outline"
            className="h-11 px-4"
            onClick={handleManualAdd}
          >
            Add
          </Button>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="border-t border-border bg-card px-4 pt-4 pb-6">
        <div
          data-ocid="batch_udhaar.total.section"
          className="text-center mb-4"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
            Total
          </p>
          <p className="text-3xl font-bold text-foreground">
            {formatCurrency(total)}
          </p>
          {items.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {items.length} item{items.length !== 1 ? "s" : ""} ·{" "}
              {items.reduce((s, i) => s + i.qty, 0)} units
            </p>
          )}
        </div>
        <Button
          type="button"
          data-ocid="batch_udhaar.save.primary_button"
          className="w-full h-14 text-base font-bold"
          style={{ backgroundColor: "var(--slate-dark)", color: "white" }}
          onClick={handleSaveAll}
          disabled={addBatchTx.isPending || items.length === 0}
        >
          {addBatchTx.isPending ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : null}
          {addBatchTx.isPending ? "Saving…" : "Save All"}
        </Button>
        <button
          type="button"
          data-ocid="batch_udhaar.cancel.button"
          onClick={onClose}
          className="w-full text-center mt-3 text-sm text-muted-foreground hover:text-foreground py-1"
        >
          Cancel
        </button>
      </div>

      {/* Add Manually Bottom Sheet */}
      {addManuallyOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/50 cursor-default"
            onClick={dismissSheet}
          />
          <div className="relative bg-background rounded-t-2xl shadow-2xl px-4 pt-4 pb-8">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-4" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-foreground">
                Add New Product
              </h2>
              <button
                type="button"
                data-ocid="batch_udhaar.add_manually.close_button"
                onClick={dismissSheet}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="am-barcode"
                  className="text-xs font-medium text-muted-foreground mb-1 block"
                >
                  Barcode
                </label>
                <Input
                  id="am-barcode"
                  data-ocid="batch_udhaar.add_manually_barcode.input"
                  value={addManuallyForm.barcode}
                  onChange={(e) =>
                    setAddManuallyForm((f) => ({
                      ...f,
                      barcode: e.target.value,
                    }))
                  }
                  placeholder="Barcode"
                  className="h-11"
                />
              </div>
              <div>
                <label
                  htmlFor="am-name"
                  className="text-xs font-medium text-muted-foreground mb-1 block"
                >
                  Product Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="am-name"
                  data-ocid="batch_udhaar.add_manually_name.input"
                  // biome-ignore lint/a11y/noAutofocus: intentional for mobile UX
                  autoFocus
                  value={addManuallyForm.name}
                  onChange={(e) =>
                    setAddManuallyForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Parle-G Biscuit"
                  className="h-11"
                />
              </div>
              <div>
                <label
                  htmlFor="am-price"
                  className="text-xs font-medium text-muted-foreground mb-1 block"
                >
                  Price
                </label>
                <Input
                  id="am-price"
                  data-ocid="batch_udhaar.add_manually_price.input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={addManuallyForm.price}
                  onChange={(e) =>
                    setAddManuallyForm((f) => ({
                      ...f,
                      price: e.target.value,
                    }))
                  }
                  placeholder="0.00"
                  className="h-11"
                />
              </div>
            </div>
            <Button
              type="button"
              data-ocid="batch_udhaar.add_manually.submit_button"
              className="w-full h-12 text-sm font-bold mt-5"
              onClick={handleSaveManually}
              disabled={addManuallyLoading || !addManuallyForm.name.trim()}
            >
              {addManuallyLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {addManuallyLoading ? "Saving…" : "Save & Add to Batch"}
            </Button>
          </div>
        </div>
      )}

      {/* WhatsApp Receipt Prompt */}
      {whatsappPrompt?.show && !addPhonePrompt && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 bg-black/50"
            onClick={handleWhatsAppNo}
          />
          <div className="relative bg-background rounded-t-2xl shadow-2xl px-5 pt-5 pb-8 w-full max-w-md">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-5" />
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <MessageCircle size={20} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Send WhatsApp receipt?
                </h2>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(whatsappPrompt.savedTotal)} ·{" "}
                  {whatsappPrompt.savedItems.length} item
                  {whatsappPrompt.savedItems.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12"
                onClick={handleWhatsAppNo}
              >
                No, skip
              </Button>
              <Button
                type="button"
                className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white font-bold"
                onClick={handleWhatsAppYes}
              >
                Yes, send
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Phone Prompt (shown when customer has no phone) */}
      {addPhonePrompt && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center">
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setAddPhonePrompt(false);
              handleWhatsAppNo();
            }}
          />
          <div className="relative bg-background rounded-t-2xl shadow-2xl px-5 pt-5 pb-8 w-full max-w-md">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-5" />
            <h2 className="text-base font-bold text-foreground mb-1">
              No phone number on file
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Add {customerName}'s number to send WhatsApp receipt.
            </p>
            <Input
              // biome-ignore lint/a11y/noAutofocus: intentional for mobile UX
              autoFocus
              type="tel"
              placeholder="e.g. +91 9876543210"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="h-12 mb-4"
            />
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12"
                onClick={() => {
                  setAddPhonePrompt(false);
                  handleWhatsAppNo();
                }}
              >
                Skip
              </Button>
              <Button
                type="button"
                className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white font-bold"
                disabled={!phoneInput.trim() || phoneSaving}
                onClick={handleSavePhone}
              >
                {phoneSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save & Send
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
