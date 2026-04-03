import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Clock, Menu, ScanLine, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Screen } from "../App";
import type { CustomerBalance } from "../backend.d";
import { useCamera } from "../camera/useCamera";
import { useCustomerPhoto } from "../hooks/useCustomerPhoto";
import { useAllCustomers } from "../hooks/useQueries";
import {
  formatCurrency,
  getInitials,
  getSettings,
  isInactive,
} from "../utils/format";

interface Props {
  navigate: (s: Screen) => void;
  onOpenSidebar: () => void;
}

export function HomeScreen({ navigate, onOpenSidebar }: Props) {
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const { data: customers, isLoading } = useAllCustomers();
  const settings = getSettings();

  const { isActive, startCamera, stopCamera, videoRef } = useCamera({
    facingMode: "environment",
    width: 640,
    height: 480,
  });

  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = search.toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (cb) =>
        cb.customer.name.toLowerCase().includes(q) ||
        cb.customer.mobile.includes(q),
    );
  }, [customers, search]);

  const totalDue = useMemo(
    () => (customers || []).reduce((s, c) => s + c.remainingBalance, 0),
    [customers],
  );

  const closeScanner = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    stopCamera();
    setScannerOpen(false);
  }, [stopCamera]);

  const openScanner = async () => {
    setScannerOpen(true);
    await startCamera();
  };

  // Customer barcode scan loop
  useEffect(() => {
    if (scannerOpen && isActive) {
      const BarcodeDetectorAPI = (window as any).BarcodeDetector;
      if (!BarcodeDetectorAPI) return;
      const detector = new BarcodeDetectorAPI({
        formats: ["code_128", "code_39", "ean_13", "qr_code"],
      });

      scanIntervalRef.current = setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            const scanned = barcodes[0].rawValue as string;
            const found = customers?.find((cb) => {
              const padded = cb.customer.id.toString().padStart(10, "0");
              return (
                padded === scanned || cb.customer.id.toString() === scanned
              );
            });
            if (found) {
              closeScanner();
              navigate({ id: "customerProfile", customer: found });
            } else {
              toast.error("Customer not found");
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
  }, [scannerOpen, isActive, videoRef, customers, navigate, closeScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, []);

  return (
    <div className="screen-container">
      {/* Header */}
      <div className="app-header px-4 pt-12 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-ocid="home.sidebar.toggle"
              onClick={onOpenSidebar}
              className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 flex-shrink-0"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-white text-xl font-bold">Udhar</h1>
              <p className="text-white/60 text-xs mt-0.5">
                {customers?.length || 0} customers · {formatCurrency(totalDue)}{" "}
                due
              </p>
            </div>
          </div>
          <div className="bg-white/10 rounded-full px-3 py-1">
            <span className="text-white/80 text-xs font-medium">Today</span>
          </div>
        </div>
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50"
              size={16}
            />
            <Input
              data-ocid="home.search_input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or mobile…"
              className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 h-10 text-sm"
            />
          </div>
          <button
            type="button"
            data-ocid="home.scan_customer.button"
            onClick={openScanner}
            className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:bg-white/20 flex-shrink-0"
            title="Scan customer barcode"
          >
            <ScanLine size={18} />
          </button>
        </div>
      </div>

      {/* Customer list */}
      <div className="scroll-area px-4 py-4 space-y-2 pb-6">
        {isLoading && (
          <div data-ocid="home.loading_state" className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div
            data-ocid="home.empty_state"
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search size={24} className="text-muted-foreground" />
            </div>
            <p className="text-foreground font-semibold">No customers yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Go to Customers section to add your first customer
            </p>
          </div>
        )}

        {!isLoading &&
          filtered.map((cb, idx) => (
            <CustomerRow
              key={cb.customer.id.toString()}
              cb={cb}
              threshold={settings.threshold}
              inactiveDays={settings.inactiveDays}
              index={idx + 1}
              onClick={() => navigate({ id: "customerProfile", customer: cb })}
            />
          ))}
      </div>

      {/* Customer Barcode Scanner Overlay */}
      {scannerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col"
          data-ocid="home.scan_customer.modal"
        >
          <div className="flex items-center justify-between px-4 pt-12 pb-4">
            <p className="text-white font-semibold text-base">
              Scan Customer Barcode
            </p>
            <button
              type="button"
              data-ocid="home.scan_customer.close_button"
              onClick={closeScanner}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="border-2 border-white/60 rounded-lg"
                style={{ width: 260, height: 100 }}
              />
            </div>
          </div>
          <div className="px-4 py-6 text-center">
            <p className="text-white/60 text-sm">
              Point camera at customer barcode
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerRow({
  cb,
  threshold,
  inactiveDays,
  index,
  onClick,
}: {
  cb: CustomerBalance;
  threshold: number;
  inactiveDays: number;
  index: number;
  onClick: () => void;
}) {
  const isHigh = cb.remainingBalance > threshold;
  const inactive = isInactive(cb.lastPaymentDate, inactiveDays);
  const { photoUrl } = useCustomerPhoto(cb.customer.id);

  return (
    <button
      type="button"
      data-ocid={`customers.item.${index}`}
      className="customer-row w-full text-left"
      onClick={onClick}
    >
      {/* Avatar */}
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={cb.customer.name}
          className="w-11 h-11 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: "var(--slate-dark)" }}
        >
          {getInitials(cb.customer.name)}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm truncate">
          {cb.customer.name}
        </p>
        <p className="text-muted-foreground text-xs mt-0.5">
          {cb.customer.mobile}
        </p>
        <div className="flex gap-1.5 mt-1.5">
          {isHigh && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle size={10} /> High
            </span>
          )}
          {inactive && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              <Clock size={10} /> Inactive
            </span>
          )}
        </div>
      </div>

      {/* Balance */}
      <div className="text-right flex-shrink-0">
        <p
          className={`text-sm font-bold ${
            cb.remainingBalance > 0 ? "text-destructive" : "text-primary"
          }`}
        >
          {formatCurrency(cb.remainingBalance)}
        </p>
        <p className="text-muted-foreground text-[10px] mt-0.5">remaining</p>
      </div>
    </button>
  );
}
