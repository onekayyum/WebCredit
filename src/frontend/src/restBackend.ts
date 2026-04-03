import type {
  Customer,
  CustomerBalance,
  Product,
  Transaction,
  backendInterface,
} from "./backend.d";

const API_BASE = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:3001";

function toBigInt(value: string | number | bigint): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

function mapCustomer(c: any): Customer {
  return {
    id: toBigInt(c.id),
    name: c.name,
    mobile: c.mobile,
    createdAt: toBigInt(c.createdAt),
  };
}

function mapProduct(p: any): Product {
  return {
    id: toBigInt(p.id),
    name: p.name,
    barcode: p.barcode,
    price: p.price,
    createdAt: toBigInt(p.createdAt),
  };
}

function mapTransaction(t: any): Transaction {
  return {
    id: toBigInt(t.id),
    customerId: toBigInt(t.customerId),
    productName: t.productName,
    note: t.note,
    amount: t.amount,
    txType: t.txType,
    timestamp: toBigInt(t.timestamp),
    itemsJson: t.itemsJson ?? undefined,
  };
}

function mapBalance(b: any): CustomerBalance {
  return {
    totalUdhaar: b.totalUdhaar,
    totalPaid: b.totalPaid,
    remainingBalance: b.remainingBalance,
    lastPaymentDate: toBigInt(b.lastPaymentDate),
    customer: mapCustomer(b.customer),
  };
}

async function invoke(method: string, payload: object = {}): Promise<any> {
  const response = await fetch(`${API_BASE}/api/backend/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json();
}

export function createRestBackend(): backendInterface {
  return {
    async addBatchTransaction(customerId, totalAmount, itemsJson, note) {
      const result = await invoke("addBatchTransaction", { customerId: customerId.toString(), totalAmount, itemsJson, note });
      return result ? mapTransaction(result) : null;
    },
    async addCustomer(name, mobile) {
      const result = await invoke("addCustomer", { name, mobile });
      return result ? mapCustomer(result) : null;
    },
    async addProduct(name, price, barcode) {
      const result = await invoke("addProduct", { name, price, barcode });
      return result ? mapProduct(result) : null;
    },
    async addTransaction(customerId, productName, note, amount, txType) {
      const result = await invoke("addTransaction", { customerId: customerId.toString(), productName, note, amount, txType });
      return result ? mapTransaction(result) : null;
    },
    async bulkImportProducts(productList) {
      const normalized = productList.map((p) => ({ ...p, id: p.id.toString(), createdAt: p.createdAt.toString() }));
      const result = await invoke("bulkImportProducts", { productList: normalized });
      return [toBigInt(result[0]), toBigInt(result[1])];
    },
    async deleteCustomer(id) {
      return invoke("deleteCustomer", { id: id.toString() });
    },
    async deleteProduct(id) {
      return invoke("deleteProduct", { id: id.toString() });
    },
    async deleteTransaction(id) {
      return invoke("deleteTransaction", { id: id.toString() });
    },
    async getAllCustomers() {
      const result = await invoke("getAllCustomers");
      return result.map(mapBalance);
    },
    async getAllProducts() {
      const result = await invoke("getAllProducts");
      return result.map(mapProduct);
    },
    async getCustomerBalanceSummary(customerId) {
      const result = await invoke("getCustomerBalanceSummary", { customerId: customerId.toString() });
      return result ? mapBalance(result) : null;
    },
    async getCustomersSortedByBalance() {
      const result = await invoke("getCustomersSortedByBalance");
      return result.map(mapBalance);
    },
    async getHighBalanceCustomers(threshold) {
      const result = await invoke("getHighBalanceCustomers", { threshold });
      return result.map(mapBalance);
    },
    async getInactiveCustomers(days) {
      const result = await invoke("getInactiveCustomers", { days: days.toString() });
      return result.map(mapBalance);
    },
    async getTransactionsForCustomer(customerId) {
      const result = await invoke("getTransactionsForCustomer", { customerId: customerId.toString() });
      return result.map(mapTransaction);
    },
    async searchCustomers(term) {
      const result = await invoke("searchCustomers", { term });
      return result.map(mapCustomer);
    },
    async searchProducts(term) {
      const result = await invoke("searchProducts", { term });
      return result.map(mapProduct);
    },
    async updateCustomer(id, name, mobile) {
      return invoke("updateCustomer", { id: id.toString(), name, mobile });
    },
    async updateProduct(id, name, price, barcode) {
      return invoke("updateProduct", { id: id.toString(), name, price, barcode });
    },
  };
}
