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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Share2,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { CustomerBalance } from "../backend.d";
import { useDeleteTransaction, useTransactions } from "../hooks/useQueries";
import { formatCurrency, formatTimestamp, getInitials } from "../utils/format";

type Filter = "all" | "udhaar" | "payment";

interface BatchItem {
  name: string;
  price: number;
  qty: number;
  subtotal: number;
}

interface Props {
  customerBalance: CustomerBalance;
  onBack: () => void;
}

export function TransactionHistory({ customerBalance, onBack }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [deleteId, setDeleteId] = useState<bigint | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { data: transactions, isLoading } = useTransactions(
    customerBalance.customer.id,
  );
  const deleteTransaction = useDeleteTransaction();

  const filtered = useMemo(() => {
    if (!transactions) return [];
    if (filter === "all")
      return [...transactions].sort((a, b) =>
        Number(b.timestamp - a.timestamp),
      );
    return [...transactions]
      .filter((t) => t.txType === filter)
      .sort((a, b) => Number(b.timestamp - a.timestamp));
  }, [transactions, filter]);

  const totalDue = useMemo(() => {
    if (!transactions) return 0;
    return transactions.reduce((sum, t) => {
      return t.txType === "udhaar" ? sum + t.amount : sum - t.amount;
    }, 0);
  }, [transactions]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteTransaction.mutateAsync(deleteId);
    toast.success("Transaction deleted");
    setDeleteId(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleWhatsApp = (tx: (typeof filtered)[0]) => {
    const mobile = customerBalance.customer.mobile.replace(/[^0-9]/g, "");
    const date = formatTimestamp(tx.timestamp);
    let itemLines = "";
    if (tx.itemsJson) {
      try {
        const items = JSON.parse(tx.itemsJson) as BatchItem[];
        itemLines = items
          .map((i) => `  ${i.name} × ${i.qty} = ${formatCurrency(i.subtotal)}`)
          .join("\n");
      } catch (_e) {
        itemLines = `  ${tx.productName}`;
      }
    } else {
      itemLines = `  ${tx.productName}`;
    }
    const receipt = [
      "🧾 Shop Receipt",
      `Customer: ${customerBalance.customer.name}`,
      `Date: ${date}`,
      "---",
      itemLines,
      "---",
      `Total: ${formatCurrency(tx.amount)}`,
    ].join("\n");
    const url = `https://wa.me/${mobile}?text=${encodeURIComponent(receipt)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="screen-container">
      {/* Header */}
      <div className="app-header px-4 pt-12 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            data-ocid="history.back.button"
            onClick={onBack}
            className="text-white/80 hover:text-white"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            >
              {getInitials(customerBalance.customer.name)}
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">
                {customerBalance.customer.name}
              </h2>
              <p className="text-white/60 text-xs">Transaction History</p>
            </div>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2" data-ocid="history.filter.tab">
          {(["all", "udhaar", "payment"] as Filter[]).map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? "bg-white text-secondary"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div className="scroll-area px-4 py-4 space-y-2 pb-24">
        {isLoading && (
          <div data-ocid="history.loading_state" className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div data-ocid="history.empty_state" className="text-center py-16">
            <p className="text-muted-foreground">No transactions found</p>
          </div>
        )}
        {!isLoading &&
          filtered.map((tx, idx) => {
            const txIdStr = tx.id.toString();
            const isBatch = !!tx.itemsJson;
            const isExpanded = expandedIds.has(txIdStr);
            let batchItems: BatchItem[] = [];
            if (isBatch) {
              try {
                batchItems = JSON.parse(tx.itemsJson!) as BatchItem[];
              } catch (_e) {
                batchItems = [];
              }
            }

            return (
              <div
                key={txIdStr}
                data-ocid={`history.item.${idx + 1}`}
                className="bg-card rounded-xl shadow-sm overflow-hidden"
              >
                {/* Main row */}
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        className={`text-[10px] px-2 py-0.5 ${
                          tx.txType === "payment"
                            ? "bg-primary/15 text-primary border-0"
                            : "bg-destructive/15 text-destructive border-0"
                        }`}
                      >
                        {tx.txType === "payment" ? "Payment" : "Udhaar"}
                      </Badge>
                      {isBatch && (
                        <Badge className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground border-0">
                          Batch
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-[10px]">
                        {formatTimestamp(tx.timestamp)}
                      </span>
                    </div>
                    <p className="text-foreground text-sm font-semibold truncate">
                      {isBatch
                        ? `${batchItems.length} items added`
                        : tx.productName || tx.note || "—"}
                    </p>
                    {tx.note && tx.productName && !isBatch && (
                      <p className="text-muted-foreground text-xs truncate">
                        {tx.note}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span
                      className={`font-bold text-sm ${
                        tx.txType === "payment"
                          ? "text-primary"
                          : "text-destructive"
                      }`}
                    >
                      {tx.txType === "payment" ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </span>
                    {isBatch && (
                      <button
                        type="button"
                        data-ocid={`history.whatsapp.button.${idx + 1}`}
                        onClick={() => handleWhatsApp(tx)}
                        className="text-muted-foreground hover:text-green-600 p-1"
                        title="Share via WhatsApp"
                      >
                        <Share2 size={14} />
                      </button>
                    )}
                    {isBatch && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(txIdStr)}
                        className="text-muted-foreground hover:text-foreground p-1"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      data-ocid={`history.delete_button.${idx + 1}`}
                      onClick={() => setDeleteId(tx.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Batch item breakdown */}
                {isBatch && isExpanded && batchItems.length > 0 && (
                  <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-1.5">
                    {batchItems.map((item) => (
                      <div
                        key={`${item.name}-${item.qty}`}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-foreground flex-1 truncate">
                          {item.name}
                        </span>
                        <span className="text-muted-foreground mx-2">
                          × {item.qty}
                        </span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 border-t border-border/50 text-xs font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(tx.amount)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Footer summary */}
      <div className="border-t border-border bg-card px-5 py-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-muted-foreground">
            Total Due
          </span>
          <span className="text-lg font-bold text-destructive">
            {formatCurrency(Math.max(0, totalDue))}
          </span>
        </div>
      </div>

      {/* Delete dialog */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(v) => !v && setDeleteId(null)}
      >
        <AlertDialogContent data-ocid="history.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The balance will be recalculated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="history.delete.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-ocid="history.delete.confirm_button"
              className="bg-destructive text-destructive-foreground"
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
