export interface CustomerBalance {
  customer: Customer;
  lastPaymentDate: bigint;
  totalPaid: number;
  totalUdhaar: number;
  remainingBalance: number;
}

export interface Customer {
  id: bigint;
  name: string;
  createdAt: bigint;
  mobile: string;
}

export interface Product {
  id: bigint;
  name: string;
  createdAt: bigint;
  barcode: string;
  price: number;
}

export interface Transaction {
  id: bigint;
  note: string;
  productName: string;
  timestamp: bigint;
  txType: string;
  customerId: bigint;
  amount: number;
  itemsJson?: string;
}

export interface backendInterface {
  addBatchTransaction(
    customerId: bigint,
    totalAmount: number,
    itemsJson: string,
    note: string,
  ): Promise<Transaction | null>;
  addCustomer(name: string, mobile: string): Promise<Customer | null>;
  addProduct(name: string, price: number, barcode: string): Promise<Product | null>;
  addTransaction(
    customerId: bigint,
    productName: string,
    note: string,
    amount: number,
    txType: string,
  ): Promise<Transaction | null>;
  bulkImportProducts(productList: Array<Product>): Promise<[bigint, bigint]>;
  deleteCustomer(id: bigint): Promise<boolean>;
  deleteProduct(id: bigint): Promise<boolean>;
  deleteTransaction(id: bigint): Promise<boolean>;
  getAllCustomers(): Promise<Array<CustomerBalance>>;
  getAllProducts(): Promise<Array<Product>>;
  getCustomerBalanceSummary(customerId: bigint): Promise<CustomerBalance | null>;
  getCustomersSortedByBalance(): Promise<Array<CustomerBalance>>;
  getHighBalanceCustomers(threshold: number): Promise<Array<CustomerBalance>>;
  getInactiveCustomers(days: bigint): Promise<Array<CustomerBalance>>;
  getTransactionsForCustomer(customerId: bigint): Promise<Array<Transaction>>;
  searchCustomers(term: string): Promise<Array<Customer>>;
  searchProducts(term: string): Promise<Array<Product>>;
  updateCustomer(id: bigint, name: string, mobile: string): Promise<boolean>;
  updateProduct(id: bigint, name: string, price: number, barcode: string): Promise<boolean>;
}

export interface CreateActorOptions {
  baseUrl?: string;
}

const toBigInt = (value: string | number | bigint): bigint => BigInt(value);

function asCustomer(value: any): Customer {
  return {
    id: toBigInt(value.id),
    name: value.name,
    createdAt: toBigInt(value.createdAt),
    mobile: value.mobile,
  };
}

function asProduct(value: any): Product {
  return {
    id: toBigInt(value.id),
    name: value.name,
    createdAt: toBigInt(value.createdAt),
    barcode: value.barcode,
    price: Number(value.price),
  };
}

function asTransaction(value: any): Transaction {
  return {
    id: toBigInt(value.id),
    customerId: toBigInt(value.customerId),
    productName: value.productName,
    note: value.note,
    amount: Number(value.amount),
    txType: value.txType,
    timestamp: toBigInt(value.timestamp),
    itemsJson: value.itemsJson ?? undefined,
  };
}

function asCustomerBalance(value: any): CustomerBalance {
  return {
    customer: asCustomer(value.customer),
    lastPaymentDate: toBigInt(value.lastPaymentDate),
    totalPaid: Number(value.totalPaid),
    totalUdhaar: Number(value.totalUdhaar),
    remainingBalance: Number(value.remainingBalance),
  };
}

class HttpBackend implements backendInterface {
  constructor(private readonly baseUrl: string) {}

  private async call<T = any>(method: string, payload?: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) for ${method}`);
    }

    const json = await response.json();
    if (!json.ok) {
      throw new Error(json.error ?? `Backend call failed for ${method}`);
    }

    return json.result as T;
  }

  async addBatchTransaction(customerId: bigint, totalAmount: number, itemsJson: string, note: string) {
    const result = await this.call("addBatchTransaction", {
      customerId: customerId.toString(),
      totalAmount,
      itemsJson,
      note,
    });
    return result ? asTransaction(result) : null;
  }

  async addCustomer(name: string, mobile: string) {
    const result = await this.call("addCustomer", { name, mobile });
    return result ? asCustomer(result) : null;
  }

  async addProduct(name: string, price: number, barcode: string) {
    const result = await this.call("addProduct", { name, price, barcode });
    return result ? asProduct(result) : null;
  }

  async addTransaction(customerId: bigint, productName: string, note: string, amount: number, txType: string) {
    const result = await this.call("addTransaction", {
      customerId: customerId.toString(),
      productName,
      note,
      amount,
      txType,
    });
    return result ? asTransaction(result) : null;
  }

  async bulkImportProducts(productList: Array<Product>) {
    const result = await this.call<Array<string | number>>("bulkImportProducts", {
      productList: productList.map((p) => ({
        id: p.id.toString(),
        name: p.name,
        createdAt: p.createdAt.toString(),
        barcode: p.barcode,
        price: p.price,
      })),
    });

    return [toBigInt(result[0]), toBigInt(result[1])] as [bigint, bigint];
  }

  deleteCustomer(id: bigint) {
    return this.call("deleteCustomer", { id: id.toString() });
  }

  deleteProduct(id: bigint) {
    return this.call("deleteProduct", { id: id.toString() });
  }

  deleteTransaction(id: bigint) {
    return this.call("deleteTransaction", { id: id.toString() });
  }

  async getAllCustomers() {
    const result = await this.call<any[]>("getAllCustomers");
    return result.map(asCustomerBalance);
  }

  async getAllProducts() {
    const result = await this.call<any[]>("getAllProducts");
    return result.map(asProduct);
  }

  async getCustomerBalanceSummary(customerId: bigint) {
    const result = await this.call("getCustomerBalanceSummary", {
      customerId: customerId.toString(),
    });
    return result ? asCustomerBalance(result) : null;
  }

  async getCustomersSortedByBalance() {
    const result = await this.call<any[]>("getCustomersSortedByBalance");
    return result.map(asCustomerBalance);
  }

  async getHighBalanceCustomers(threshold: number) {
    const result = await this.call<any[]>("getHighBalanceCustomers", { threshold });
    return result.map(asCustomerBalance);
  }

  async getInactiveCustomers(days: bigint) {
    const result = await this.call<any[]>("getInactiveCustomers", {
      days: days.toString(),
    });
    return result.map(asCustomerBalance);
  }

  async getTransactionsForCustomer(customerId: bigint) {
    const result = await this.call<any[]>("getTransactionsForCustomer", {
      customerId: customerId.toString(),
    });
    return result.map(asTransaction);
  }

  async searchCustomers(term: string) {
    const result = await this.call<any[]>("searchCustomers", { term });
    return result.map(asCustomer);
  }

  async searchProducts(term: string) {
    const result = await this.call<any[]>("searchProducts", { term });
    return result.map(asProduct);
  }

  updateCustomer(id: bigint, name: string, mobile: string) {
    return this.call("updateCustomer", { id: id.toString(), name, mobile });
  }

  updateProduct(id: bigint, name: string, price: number, barcode: string) {
    return this.call("updateProduct", { id: id.toString(), name, price, barcode });
  }
}

export class ExternalBlob {
  static fromURL(url: string): never {
    throw new Error(`ExternalBlob is not supported in HTTP backend mode: ${url}`);
  }
}

export async function createActor(
  _canisterId: string,
  _uploadFile: unknown,
  _downloadFile: unknown,
  options?: CreateActorOptions,
): Promise<backendInterface> {
  const baseUrl = options?.baseUrl ?? (import.meta.env.VITE_BACKEND_URL || "http://localhost:3001");
  return new HttpBackend(baseUrl);
}
