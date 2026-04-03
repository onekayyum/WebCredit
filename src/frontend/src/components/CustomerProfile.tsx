import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Clock,
  CreditCard,
  History,
  Loader2,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  QrCode,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Screen } from "../App";
import type { CustomerBalance } from "../backend.d";
import { useCustomerPhoto } from "../hooks/useCustomerPhoto";
import { useCustomerBalance, useDeleteCustomer } from "../hooks/useQueries";
import {
  formatCurrency,
  getInitials,
  getSettings,
  isInactive,
} from "../utils/format";
import { AddPaymentSheet } from "./AddPaymentSheet";
import { CustomerBarcodeSheet } from "./CustomerBarcodeSheet";
import { EditCustomerSheet } from "./EditCustomerSheet";

interface Props {
  customerBalance: CustomerBalance;
  navigate: (s: Screen) => void;
  onBack: () => void;
}

export function CustomerProfile({
  customerBalance: initialCb,
  navigate,
  onBack,
}: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deleteCustomer = useDeleteCustomer();
  const { data: freshData } = useCustomerBalance(initialCb.customer.id);
  const cb = freshData || initialCb;

  const { photoUrl, uploadPhoto, isUploading } = useCustomerPhoto(
    cb.customer.id,
  );

  const settings = getSettings();
  const isHigh = cb.remainingBalance > settings.threshold;
  const inactive = isInactive(cb.lastPaymentDate, settings.inactiveDays);

  const handleDelete = async () => {
    await deleteCustomer.mutateAsync(cb.customer.id);
    toast.success("Customer deleted");
    onBack();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadPhoto(file);
      toast.success("Photo updated!");
    } catch (_err) {
      toast.error("Failed to upload photo");
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  return (
    <div className="screen-container">
      {/* Header */}
      <div className="app-header px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            data-ocid="profile.back.button"
            onClick={onBack}
            className="text-white/80 hover:text-white p-1 -ml-1"
          >
            <ArrowLeft size={22} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-ocid="profile.menu.button"
                className="text-white/80 hover:text-white p-1"
              >
                <MoreVertical size={22} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                data-ocid="profile.edit.button"
                onClick={() => setEditOpen(true)}
              >
                <Pencil size={14} className="mr-2" /> Edit Customer
              </DropdownMenuItem>
              <DropdownMenuItem
                data-ocid="profile.delete.button"
                className="text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 size={14} className="mr-2" /> Delete Customer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Avatar + Name */}
        <div className="flex flex-col items-center">
          {/* Photo / Avatar */}
          <div className="relative mb-3">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={cb.customer.name}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
                style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
              >
                {getInitials(cb.customer.name)}
              </div>
            )}
            {/* Camera overlay */}
            <button
              type="button"
              data-ocid="profile.photo.upload_button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-md"
            >
              {isUploading ? (
                <Loader2 size={12} className="animate-spin text-gray-600" />
              ) : (
                <Camera size={12} className="text-gray-600" />
              )}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />

          <h2 className="text-white text-lg font-bold">{cb.customer.name}</h2>
          <p className="text-white/60 text-sm mt-0.5">{cb.customer.mobile}</p>
          {(isHigh || inactive) && (
            <div className="flex gap-2 mt-2">
              {isHigh && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-red-500/20 text-red-300">
                  <AlertTriangle size={11} /> High Balance
                </span>
              )}
              {inactive && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-500/20 text-amber-300">
                  <Clock size={11} /> Inactive
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="scroll-area px-4 py-4 space-y-4">
        {/* Stat cards */}
        <div
          className="grid grid-cols-3 gap-2"
          data-ocid="profile.stats.section"
        >
          <div className="stat-card">
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              Udhaar
            </span>
            <span className="text-foreground text-base font-bold">
              {formatCurrency(cb.totalUdhaar)}
            </span>
          </div>
          <div className="stat-card">
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              Paid
            </span>
            <span className="text-primary text-base font-bold">
              {formatCurrency(cb.totalPaid)}
            </span>
          </div>
          <div className="stat-card border border-destructive/20">
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              Remaining
            </span>
            <span className="text-destructive text-base font-bold">
              {formatCurrency(cb.remainingBalance)}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            data-ocid="profile.add_udhaar.primary_button"
            className="action-btn text-white font-semibold"
            style={{ backgroundColor: "var(--slate-dark)" }}
            onClick={() => navigate({ id: "batchUdhaar", customer: cb })}
          >
            <Plus size={20} className="text-white/70" />
            Add Udhaar
          </button>
          <button
            type="button"
            data-ocid="profile.add_payment.primary_button"
            className="action-btn"
            style={{ backgroundColor: "var(--teal)", color: "white" }}
            onClick={() => setPaymentOpen(true)}
          >
            <CreditCard size={20} className="text-white/80" />
            Add Payment
          </button>
          <button
            type="button"
            data-ocid="profile.view_history.button"
            className="action-btn bg-card border border-border text-foreground"
            onClick={() => navigate({ id: "transactionHistory", customer: cb })}
          >
            <History size={20} className="text-muted-foreground" />
            View History
          </button>
          <a
            data-ocid="profile.call_customer.button"
            href={`tel:${cb.customer.mobile}`}
            className="action-btn bg-card border border-border text-foreground no-underline flex flex-col items-center justify-center gap-2"
          >
            <Phone size={20} className="text-muted-foreground" />
            Call Customer
          </a>
          <button
            type="button"
            data-ocid="profile.barcode.button"
            className="action-btn bg-card border border-border text-foreground col-span-2"
            onClick={() => setBarcodeOpen(true)}
          >
            <QrCode size={20} className="text-muted-foreground" />
            Customer Barcode
          </button>
        </div>
      </div>

      {/* Sheets */}
      <AddPaymentSheet
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        customerId={cb.customer.id}
        customerName={cb.customer.name}
      />
      <EditCustomerSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={cb.customer}
      />
      <CustomerBarcodeSheet
        open={barcodeOpen}
        onOpenChange={setBarcodeOpen}
        customer={cb.customer}
      />

      {/* Delete dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent data-ocid="profile.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {cb.customer.name} and all their
              transactions. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="profile.delete.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-ocid="profile.delete.confirm_button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
