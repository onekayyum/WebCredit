import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Camera, Keyboard, Loader2, ScanLine, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Product } from "../backend.d";
import { useCamera } from "../camera/useCamera";
import {
  useAddProduct,
  useAddTransaction,
  useAllProducts,
} from "../hooks/useQueries";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: bigint;
}

type Mode = "form" | "scanner";

export function AddUdhaarSheet({ open, onOpenChange, customerId }: Props) {
  const [mode, setMode] = useState<Mode>("form");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [productNotFound, setProductNotFound] = useState(false);
  const [saveNewProduct, setSaveNewProduct] = useState(false);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: allProducts } = useAllProducts();
  const addTransaction = useAddTransaction();
  const addProduct = useAddProduct();

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

  const handleBarcodeDetected = useCallback(
    (barcode: string) => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      stopCamera();
      setMode("form");
      setBarcodeInput(barcode);
      const found = allProducts?.find((p) => p.barcode === barcode);
      if (found) {
        setMatchedProduct(found);
        setProductName(found.name);
        setPrice(found.price.toString());
        setProductNotFound(false);
      } else {
        setMatchedProduct(null);
        setProductNotFound(true);
        setSaveNewProduct(true);
      }
    },
    [allProducts, stopCamera],
  );

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      stopCamera();
      setMode("form");
      setBarcodeInput("");
      setProductName("");
      setPrice("");
      setQuantity("1");
      setNote("");
      setProductNotFound(false);
      setSaveNewProduct(false);
      setMatchedProduct(null);
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    }
  }, [open, stopCamera]);

  // BarcodeDetector scanning loop
  useEffect(() => {
    if (mode === "scanner" && isActive) {
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
            handleBarcodeDetected(barcodes[0].rawValue);
          }
        } catch (_e) {
          /* silent */
        }
      }, 500);
      return () => {
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      };
    }
  }, [mode, isActive, videoRef, handleBarcodeDetected]);

  const handleManualBarcode = () => {
    if (!barcodeInput.trim()) return;
    const found = allProducts?.find((p) => p.barcode === barcodeInput.trim());
    if (found) {
      setMatchedProduct(found);
      setProductName(found.name);
      setPrice(found.price.toString());
      setProductNotFound(false);
    } else {
      setMatchedProduct(null);
      setProductNotFound(true);
      setSaveNewProduct(true);
    }
  };

  const openScanner = async () => {
    setMode("scanner");
    await startCamera();
  };

  const closeScanner = () => {
    stopCamera();
    setMode("form");
  };

  const total =
    (Number.parseFloat(price) || 0) * (Number.parseInt(quantity) || 1);

  const handleConfirm = async () => {
    if (!productName.trim()) {
      toast.error("Enter product name");
      return;
    }
    if (!price || Number.parseFloat(price) <= 0) {
      toast.error("Enter valid price");
      return;
    }

    if (saveNewProduct && productNotFound && barcodeInput.trim()) {
      await addProduct.mutateAsync({
        name: productName.trim(),
        price: Number.parseFloat(price),
        barcode: barcodeInput.trim(),
      });
    }

    const result = await addTransaction.mutateAsync({
      customerId,
      productName: productName.trim(),
      note: note.trim(),
      amount: total,
      txType: "udhaar",
    });
    if (result) {
      toast.success(`Udhaar added: ₹${total}`);
      onOpenChange(false);
    } else {
      toast.error("Failed to add udhaar");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl pb-8 px-0"
        style={{ maxHeight: "90vh" }}
        data-ocid="add_udhaar.sheet"
      >
        <SheetHeader className="px-5 mb-4">
          <SheetTitle>Add Udhaar</SheetTitle>
        </SheetHeader>

        {mode === "scanner" ? (
          <div className="px-5 space-y-3">
            <div
              className="relative rounded-xl overflow-hidden bg-black"
              style={{ aspectRatio: "4/3" }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-32 border-2 border-white/60 rounded-lg relative">
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
            </div>
            {isActive && !camError && (
              <p className="text-center text-muted-foreground text-sm">
                Point camera at barcode…
              </p>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12"
                onClick={closeScanner}
              >
                <X size={16} className="mr-2" /> Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12"
                onClick={() => {
                  closeScanner();
                  setMode("form");
                }}
              >
                <Keyboard size={16} className="mr-2" /> Manual Entry
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="px-5 space-y-4 overflow-y-auto"
            style={{ maxHeight: "calc(90vh - 100px)" }}
          >
            {/* Barcode row */}
            <div>
              <Label>Barcode</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  data-ocid="add_udhaar.barcode.input"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan or enter barcode"
                  className="flex-1 h-12"
                />
                {isSupported !== false && (
                  <Button
                    type="button"
                    data-ocid="add_udhaar.scan.button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 flex-shrink-0"
                    onClick={openScanner}
                  >
                    <Camera size={18} />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 flex-shrink-0"
                  onClick={handleManualBarcode}
                >
                  <ScanLine size={18} />
                </Button>
              </div>
            </div>

            {productNotFound && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-destructive text-sm font-medium">
                  Product not found
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Enter details manually below
                </p>
              </div>
            )}
            {matchedProduct && (
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                <p className="text-primary text-sm font-medium">
                  ✓ Product matched: {matchedProduct.name}
                </p>
              </div>
            )}

            <div>
              <Label>Product Name *</Label>
              <Input
                data-ocid="add_udhaar.product_name.input"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Product name"
                className="mt-1 h-12"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price (₹) *</Label>
                <Input
                  data-ocid="add_udhaar.price.input"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  type="number"
                  min="0"
                  placeholder="0"
                  className="mt-1 h-12"
                />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  data-ocid="add_udhaar.quantity.input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  type="number"
                  min="1"
                  className="mt-1 h-12"
                />
              </div>
            </div>

            {productNotFound && barcodeInput && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveNewProduct}
                  onChange={(e) => setSaveNewProduct(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm text-muted-foreground">
                  Save as new product
                </span>
              </label>
            )}

            <div>
              <Label>Note (optional)</Label>
              <Input
                data-ocid="add_udhaar.note.input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note"
                className="mt-1 h-12"
              />
            </div>

            {total > 0 && (
              <div className="flex justify-between items-center p-3 rounded-xl bg-muted">
                <span className="text-sm font-medium">Total Amount</span>
                <span className="text-lg font-bold text-destructive">
                  ₹{total.toLocaleString("en-IN")}
                </span>
              </div>
            )}

            <Button
              type="button"
              data-ocid="add_udhaar.confirm.primary_button"
              className="w-full h-12 font-semibold"
              style={{ backgroundColor: "var(--slate-dark)", color: "white" }}
              onClick={handleConfirm}
              disabled={addTransaction.isPending}
            >
              {addTransaction.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {addTransaction.isPending ? "Adding…" : "Confirm Udhaar"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
