import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
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
    addBatchTransaction(customerId: bigint, totalAmount: number, itemsJson: string, note: string): Promise<Transaction | null>;
    addCustomer(name: string, mobile: string): Promise<Customer | null>;
    addProduct(name: string, price: number, barcode: string): Promise<Product | null>;
    addTransaction(customerId: bigint, productName: string, note: string, amount: number, txType: string): Promise<Transaction | null>;
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
