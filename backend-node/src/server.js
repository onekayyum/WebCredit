import cors from "cors";
import express from "express";
import { createRepository } from "./repository.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const dbPath = process.env.SQLITE_PATH || "./backend-node/data.sqlite";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const repo = await createRepository(dbPath);

const toTransport = (value) =>
  JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  );

const methods = {
  addBatchTransaction: (body) =>
    repo.addBatchTransaction(body.customerId, body.totalAmount, body.itemsJson, body.note),
  addCustomer: (body) => repo.addCustomer(body.name, body.mobile),
  addProduct: (body) => repo.addProduct(body.name, body.price, body.barcode),
  addTransaction: (body) =>
    repo.addTransaction(
      body.customerId,
      body.productName,
      body.note,
      body.amount,
      body.txType,
    ),
  bulkImportProducts: (body) => repo.bulkImportProducts(body.productList ?? []),
  deleteCustomer: (body) => repo.deleteCustomer(body.id),
  deleteProduct: (body) => repo.deleteProduct(body.id),
  deleteTransaction: (body) => repo.deleteTransaction(body.id),
  getAllCustomers: () => repo.getAllCustomers(),
  getAllProducts: () => repo.getAllProducts(),
  getCustomerBalanceSummary: (body) => repo.getCustomerBalanceSummary(body.customerId),
  getCustomersSortedByBalance: () => repo.getCustomersSortedByBalance(),
  getHighBalanceCustomers: (body) => repo.getHighBalanceCustomers(body.threshold),
  getInactiveCustomers: (body) => repo.getInactiveCustomers(body.days),
  getTransactionsForCustomer: (body) => repo.getTransactionsForCustomer(body.customerId),
  searchCustomers: (body) => repo.searchCustomers(body.term),
  searchProducts: (body) => repo.searchProducts(body.term),
  updateCustomer: (body) => repo.updateCustomer(body.id, body.name, body.mobile),
  updateProduct: (body) => repo.updateProduct(body.id, body.name, body.price, body.barcode),
};

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

for (const methodName of Object.keys(methods)) {
  app.post(`/api/${methodName}`, async (req, res) => {
    try {
      const result = await methods[methodName](req.body ?? {});
      res.json({ ok: true, result: toTransport(result) });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}

app.listen(port, () => {
  console.log(`WebCredit backend running on http://localhost:${port}`);
});
