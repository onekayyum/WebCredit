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
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  FileText,
  Loader2,
  Menu,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { toast } from "sonner";
import type { Screen } from "../App";
import type { Product } from "../backendTypes";
import {
  useAddProduct,
  useAllProducts,
  useDeleteProduct,
  useExportProductsCsv,
  useImportProductsCsv,
  useUpdateProduct,
} from "../hooks/useQueries";
import { formatCurrency } from "../utils/format";

interface Props {
  navigate: (s: Screen) => void;
  onOpenSidebar: () => void;
}

export function ProductsScreen({ navigate: _navigate, onOpenSidebar }: Props) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [importProgress, setImportProgress] = useState<{
    loaded: number;
    total: number;
  } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<bigint | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: products, isLoading } = useAllProducts();
  const deleteProduct = useDeleteProduct();
  const importCsv = useImportProductsCsv();
  const exportCsv = useExportProductsCsv();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (products || []).filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q),
    );
  }, [products, search]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteProduct.mutateAsync(deleteId);
    toast.success("Product deleted");
    setDeleteId(null);
  };

  const handleCSVFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.info(`Importing "${file.name}"...`);
    try {
      const summary = await importCsv.mutateAsync({
        file,
        onProgress: (loaded, total) => setImportProgress({ loaded, total }),
      });
      toast.success(
        `Import complete: ${summary.imported} imported, ${summary.updated} updated, ${summary.skipped} skipped (total ${summary.totalRows})`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "CSV import failed");
    } finally {
      setImportProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="screen-container">
      <div className="app-header px-4 pt-12 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-ocid="products.sidebar.toggle"
              onClick={onOpenSidebar}
              className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 flex-shrink-0"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-white text-xl font-bold">{t("products")}</h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              data-ocid="products.csv_import.upload_button"
              onClick={() => fileRef.current?.click()}
              className="bg-white/10 text-white rounded-lg p-2"
              title="Import CSV"
            >
              <Upload size={18} />
            </button>
            <button
              type="button"
              onClick={() => exportCsv.mutate()}
              className="bg-white/10 text-white rounded-lg p-2"
              title="Export CSV"
            >
              <Download size={18} />
            </button>
            <button
              type="button"
              data-ocid="products.add.primary_button"
              onClick={() => setAddOpen(true)}
              className="bg-white/10 text-white rounded-lg p-2"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50"
            size={16}
          />
          <Input
            ref={searchRef}
            data-ocid="products.search_input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered[0]) {
                setEditProduct(filtered[0]);
              }
            }}
            placeholder="Search by name or barcode…"
            className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 h-10 text-sm"
          />
        </div>
        {importProgress && (
          <p className="text-xs text-white/75 mt-2">
            Importing {importProgress.loaded.toLocaleString()} /{" "}
            {importProgress.total.toLocaleString()} bytes...
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={handleCSVFile}
          data-ocid="products.csv.dropzone"
        />
      </div>

      <div className="scroll-area px-4 py-4 space-y-2 pb-6">
        {isLoading && (
          <div data-ocid="products.loading_state" className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div data-ocid="products.empty_state" className="text-center py-16">
            <FileText
              size={40}
              className="mx-auto text-muted-foreground mb-3"
            />
            <p className="text-muted-foreground">
              {search ? "No products match your search" : "No products yet"}
            </p>
          </div>
        )}

        {!isLoading &&
          filtered.map((p, idx) => (
            <div
              key={p.id.toString()}
              data-ocid={`products.item.${idx + 1}`}
              className="bg-card rounded-xl px-4 py-3 shadow-sm flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm truncate">
                  {p.name}
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Barcode: {p.barcode}
                </p>
              </div>
              <span className="text-foreground font-bold text-sm flex-shrink-0">
                {formatCurrency(p.price)}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  data-ocid={`products.edit_button.${idx + 1}`}
                  onClick={() => setEditProduct(p)}
                  className="text-muted-foreground hover:text-foreground p-1.5"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  data-ocid={`products.delete_button.${idx + 1}`}
                  onClick={() => setDeleteId(p.id)}
                  className="text-muted-foreground hover:text-destructive p-1.5"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
      </div>

      <ProductFormSheet open={addOpen} onOpenChange={setAddOpen} mode="add" />

      {editProduct && (
        <ProductFormSheet
          open={!!editProduct}
          onOpenChange={(v) => !v && setEditProduct(null)}
          mode="edit"
          product={editProduct}
        />
      )}

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(v) => !v && setDeleteId(null)}
      >
        <AlertDialogContent data-ocid="products.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="products.delete.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-ocid="products.delete.confirm_button"
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

function ProductFormSheet({
  open,
  onOpenChange,
  mode,
  product,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "add" | "edit";
  product?: Product;
}) {
  const [name, setName] = useState(product?.name || "");
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [barcode, setBarcode] = useState(product?.barcode || "");
  const [errors, setErrors] = useState<{
    name?: string;
    price?: string;
    barcode?: string;
  }>({});

  const addProduct = useAddProduct();
  const updateProduct = useUpdateProduct();
  const isPending = addProduct.isPending || updateProduct.isPending;

  const validate = () => {
    const e: { name?: string; price?: string; barcode?: string } = {};
    if (!name.trim()) e.name = "Required";
    if (!price || Number.parseFloat(price) <= 0) e.price = "Enter valid price";
    if (!barcode.trim()) e.barcode = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (mode === "add") {
      const result = await addProduct.mutateAsync({
        name: name.trim(),
        price: Number.parseFloat(price),
        barcode: barcode.trim(),
      });
      if (result) {
        toast.success("Product added");
        onOpenChange(false);
      } else {
        toast.error("Barcode already exists");
      }
    } else if (product) {
      const ok = await updateProduct.mutateAsync({
        id: product.id,
        name: name.trim(),
        price: Number.parseFloat(price),
        barcode: barcode.trim(),
      });
      if (ok) {
        toast.success("Product updated");
        onOpenChange(false);
      } else {
        toast.error("Update failed");
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl px-5 pb-8"
        data-ocid={mode === "add" ? "add_product.sheet" : "edit_product.sheet"}
      >
        <SheetHeader className="mb-5">
          <SheetTitle>
            {mode === "add" ? "Add Product" : "Edit Product"}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <div>
            <Label>Product Name *</Label>
            <Input
              data-ocid={
                mode === "add"
                  ? "add_product.name.input"
                  : "edit_product.name.input"
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Product name"
              className="mt-1 h-12"
            />
            {errors.name && (
              <p className="text-destructive text-xs mt-1">{errors.name}</p>
            )}
          </div>
          <div>
            <Label>Price *</Label>
            <Input
              data-ocid={
                mode === "add"
                  ? "add_product.price.input"
                  : "edit_product.price.input"
              }
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min="0"
              placeholder="0"
              className="mt-1 h-12"
            />
            {errors.price && (
              <p className="text-destructive text-xs mt-1">{errors.price}</p>
            )}
          </div>
          <div>
            <Label>Barcode *</Label>
            <Input
              data-ocid={
                mode === "add"
                  ? "add_product.barcode.input"
                  : "edit_product.barcode.input"
              }
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Barcode"
              className="mt-1 h-12"
            />
            {errors.barcode && (
              <p className="text-destructive text-xs mt-1">{errors.barcode}</p>
            )}
          </div>
          <Button
            type="button"
            data-ocid={
              mode === "add"
                ? "add_product.submit_button"
                : "edit_product.save_button"
            }
            className="w-full h-12 font-semibold"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isPending
              ? "Saving…"
              : mode === "add"
                ? "Add Product"
                : "Save Changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
