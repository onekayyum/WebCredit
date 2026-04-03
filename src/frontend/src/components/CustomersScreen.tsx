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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Menu, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Screen } from "../App";
import type { Customer } from "../backend.d";
import { useCustomerPhoto } from "../hooks/useCustomerPhoto";
import { useAllCustomers, useDeleteCustomer } from "../hooks/useQueries";
import { formatCurrency, getInitials } from "../utils/format";
import { AddCustomerSheet } from "./AddCustomerSheet";
import { EditCustomerSheet } from "./EditCustomerSheet";

interface Props {
  navigate: (s: Screen) => void;
  onOpenSidebar: () => void;
}

function CustomerAvatar({ customer }: { customer: Customer }) {
  const { photoUrl } = useCustomerPhoto(customer.id);
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={customer.name}
        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
      <span className="text-primary text-sm font-bold">
        {getInitials(customer.name)}
      </span>
    </div>
  );
}

export function CustomersScreen({ navigate, onOpenSidebar }: Props) {
  const { data: customers, isLoading } = useAllCustomers();
  const deleteCustomer = useDeleteCustomer();

  const [search, setSearch] = useState("");
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const filtered = (customers ?? []).filter((cb) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const c = cb.customer;
    return (
      c.name.toLowerCase().includes(q) ||
      c.mobile.includes(q) ||
      c.id.toString().includes(q)
    );
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteCustomer.mutateAsync(deleteTarget.id);
    toast.success("Customer deleted");
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="app-header px-4 pt-12 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-ocid="customers.open_modal_button"
            onClick={onOpenSidebar}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-white text-lg font-bold tracking-tight">
              Customers
            </h1>
            <p className="text-white/60 text-xs">
              {customers?.length ?? 0} customers
            </p>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="px-4 py-3 flex-shrink-0">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            data-ocid="customers.search_input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, mobile, ID…"
            className="pl-9 h-11"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {isLoading && (
          <div data-ocid="customers.loading_state" className="space-y-3 mt-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div
            data-ocid="customers.empty_state"
            className="flex flex-col items-center justify-center py-16 gap-3 text-center"
          >
            <UserRound size={48} className="text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {search ? "No customers match your search" : "No customers yet"}
            </p>
            {!search && (
              <Button
                data-ocid="customers.primary_button"
                size="sm"
                onClick={() => setAddOpen(true)}
              >
                Add your first customer
              </Button>
            )}
          </div>
        )}

        {!isLoading &&
          filtered.map((cb, idx) => (
            <div
              key={cb.customer.id.toString()}
              data-ocid={`customers.item.${idx + 1}`}
              className="flex items-center gap-3 py-3 border-b border-border last:border-0"
            >
              {/* Index */}
              <span className="text-xs text-muted-foreground w-5 flex-shrink-0 text-center">
                {idx + 1}
              </span>

              {/* Tappable area: avatar + info */}
              <button
                type="button"
                data-ocid={`customers.row.${idx + 1}`}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
                onClick={() =>
                  navigate({ id: "customerProfile", customer: cb })
                }
              >
                <CustomerAvatar customer={cb.customer} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {cb.customer.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {cb.customer.mobile || "No number"}
                  </p>
                </div>
              </button>

              {/* Balance */}
              <div className="text-right flex-shrink-0 mr-1">
                <p
                  className={`text-sm font-bold ${
                    cb.remainingBalance > 0
                      ? "text-destructive"
                      : "text-emerald-600"
                  }`}
                >
                  {formatCurrency(cb.remainingBalance)}
                </p>
                <p className="text-xs text-muted-foreground">due</p>
              </div>

              {/* Actions */}
              <div className="flex gap-1">
                <button
                  type="button"
                  data-ocid={`customers.edit_button.${idx + 1}`}
                  onClick={() => setEditCustomer(cb.customer)}
                  className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  data-ocid={`customers.delete_button.${idx + 1}`}
                  onClick={() => setDeleteTarget(cb.customer)}
                  className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20"
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
      </div>

      {/* FAB */}
      <button
        type="button"
        data-ocid="customers.primary_button"
        onClick={() => setAddOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
        aria-label="Add customer"
      >
        <Plus size={24} />
      </button>

      {/* Add sheet */}
      <AddCustomerSheet open={addOpen} onOpenChange={setAddOpen} />

      {/* Edit sheet */}
      {editCustomer && (
        <EditCustomerSheet
          open={!!editCustomer}
          onOpenChange={(v) => !v && setEditCustomer(null)}
          customer={editCustomer}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent data-ocid="customers.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong>{" "}
              and all their transaction history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="customers.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-ocid="customers.confirm_button"
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
