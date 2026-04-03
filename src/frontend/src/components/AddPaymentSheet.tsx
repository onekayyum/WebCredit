import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAddTransaction } from "../hooks/useQueries";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: bigint;
  customerName: string;
}

export function AddPaymentSheet({
  open,
  onOpenChange,
  customerId,
  customerName,
}: Props) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const addTransaction = useAddTransaction();

  const handleConfirm = async () => {
    const amt = Number.parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter valid amount");
      return;
    }
    const result = await addTransaction.mutateAsync({
      customerId,
      productName: "",
      note: note.trim() || `Payment by ${customerName}`,
      amount: amt,
      txType: "payment",
    });
    if (result) {
      toast.success(`Payment recorded: ₹${amt}`);
      setAmount("");
      setNote("");
      onOpenChange(false);
    } else {
      toast.error("Failed to record payment");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl px-5 pb-8"
        data-ocid="add_payment.sheet"
      >
        <SheetHeader className="mb-5">
          <SheetTitle>Add Payment</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <div>
            <Label>Amount (₹) *</Label>
            <Input
              data-ocid="add_payment.amount.input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="0"
              placeholder="Enter amount"
              className="mt-1 h-12 text-lg font-semibold"
            />
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Input
              data-ocid="add_payment.note.input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
              className="mt-1 h-12"
            />
          </div>
          <Button
            data-ocid="add_payment.confirm.primary_button"
            className="w-full h-12 font-semibold"
            style={{ backgroundColor: "var(--teal)", color: "white" }}
            onClick={handleConfirm}
            disabled={addTransaction.isPending}
          >
            {addTransaction.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {addTransaction.isPending ? "Recording…" : "Confirm Payment"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
