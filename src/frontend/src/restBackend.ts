import { buildApiUrl } from "./apiConfig";
import type {
  Customer,
  CustomerBalance,
  Product,
  Transaction,
  backendInterface,
} from "./backendTypes";
import { clearAuthSession, getToken } from "./utils/auth";

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
  const url = buildApiUrl(`/api/backend/${method}`);
  const token = getToken();
  console.log("Calling:", url);
  console.log(`[API] POST ${url}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    console.log(`[API] ${method} → ${response.status}`);
    const contentType = response.headers.get("content-type");
    console.log("[API] Response content-type:", contentType);

    if (response.status === 401) {
      clearAuthSession();
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok) {
      const text = await response.text();
      console.error(`[API] ${method} failed:`, text);
      throw new Error(text || `Request failed: ${response.status}`);
    }

    if (contentType && contentType.includes("text/html")) {
      throw new Error(
        "API returned HTML instead of JSON. Check API_BASE or routing.",
      );
    }

    return response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      // Network error — fetch itself failed (no response at all)
      console.error(`[API] Network error for ${method}:`, err.message);
    }
    throw err;
  }
}

export function createRestBackend(): backendInterface {
  return {
    async exportProductsCsv() {
      const token = getToken();
      const response = await fetch(buildApiUrl("/products/export"), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (response.status === 401) {
        clearAuthSession();
        throw new Error("Session expired. Please login again.");
      }
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "products.csv";
      a.click();
      URL.revokeObjectURL(url);
    },
    async importProductsCsv(file, onProgress) {
      const token = getToken();
      if (!token) throw new Error("Missing auth token");
      const formData = new FormData();
      formData.append("file", file);
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", buildApiUrl("/products/import"));
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            onProgress(event.loaded, event.total);
          }
        };
        xhr.onload = () => {
          const contentType = xhr.getResponseHeader("content-type");
          console.log("[API] importProductsCsv content-type:", contentType);
          if (xhr.status === 401) {
            clearAuthSession();
            reject(new Error("Session expired. Please login again."));
            return;
          }
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(
              new Error(xhr.responseText || `Import failed (${xhr.status})`),
            );
            return;
          }
          if (contentType && contentType.includes("text/html")) {
            reject(
              new Error(
                "API returned HTML instead of JSON. Check API_BASE or routing.",
              ),
            );
            return;
          }
          resolve(JSON.parse(xhr.responseText));
        };
        xhr.onerror = () =>
          reject(new Error("Network error during CSV import"));
        xhr.send(formData);
      });
    },
    async addBatchTransaction(customerId, totalAmount, itemsJson, note) {
      const result = await invoke("addBatchTransaction", {
        customerId: customerId.toString(),
        totalAmount,
        itemsJson,
        note,
      });
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
      const result = await invoke("addTransaction", {
        customerId: customerId.toString(),
        productName,
        note,
        amount,
        txType,
      });
      return result ? mapTransaction(result) : null;
    },
    async bulkImportProducts(productList) {
      const normalized = productList.map((p) => ({
        ...p,
        id: p.id.toString(),
        createdAt: p.createdAt.toString(),
      }));
      const result = await invoke("bulkImportProducts", {
        productList: normalized,
      });
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
      const result = await invoke("getCustomerBalanceSummary", {
        customerId: customerId.toString(),
      });
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
      const result = await invoke("getInactiveCustomers", {
        days: days.toString(),
      });
      return result.map(mapBalance);
    },
    async getTransactionsForCustomer(customerId) {
      const result = await invoke("getTransactionsForCustomer", {
        customerId: customerId.toString(),
      });
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
      return invoke("updateProduct", {
        id: id.toString(),
        name,
        price,
        barcode,
      });
    },
  };
}
