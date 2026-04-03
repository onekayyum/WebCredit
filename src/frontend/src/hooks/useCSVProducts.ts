import { useCallback, useEffect, useState } from "react";
import {
  type CSVProduct,
  clearCSVProducts,
  loadCSVProducts,
  saveCSVProducts,
} from "../utils/csvStorage";

const CSV_EVENT = "csvProductsUpdated";

export function useCSVProducts() {
  const [csvProducts, setCsvProductsState] = useState<CSVProduct[]>(() =>
    loadCSVProducts(),
  );

  // Sync across hook instances via custom window event
  useEffect(() => {
    const handler = () => {
      setCsvProductsState(loadCSVProducts());
    };
    window.addEventListener(CSV_EVENT, handler);
    return () => window.removeEventListener(CSV_EVENT, handler);
  }, []);

  const setCsvProducts = useCallback((rows: CSVProduct[]) => {
    saveCSVProducts(rows);
    setCsvProductsState(rows);
    window.dispatchEvent(new Event(CSV_EVENT));
  }, []);

  const clearCsvProducts = useCallback(() => {
    clearCSVProducts();
    setCsvProductsState([]);
    window.dispatchEvent(new Event(CSV_EVENT));
  }, []);

  return { csvProducts, setCsvProducts, clearCsvProducts };
}
