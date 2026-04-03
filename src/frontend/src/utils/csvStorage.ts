export type CSVProduct = { name: string; price: number; barcode: string };

const KEY = "csvProductsData";

export function saveCSVProducts(rows: CSVProduct[]): void {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function loadCSVProducts(): CSVProduct[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CSVProduct[]) : [];
  } catch {
    return [];
  }
}

export function clearCSVProducts(): void {
  localStorage.removeItem(KEY);
}
