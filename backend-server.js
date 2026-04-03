import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const app = express();
const PORT = Number(process.env.PORT || 3001);
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "app.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

const FRONTEND_DIST = path.join(process.cwd(), "src", "frontend", "dist");
const HAS_FRONTEND_DIST = fs.existsSync(path.join(FRONTEND_DIST, "index.html"));

db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  barcode TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY,
  customerId INTEGER NOT NULL,
  productName TEXT NOT NULL,
  note TEXT NOT NULL,
  amount REAL NOT NULL,
  txType TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  itemsJson TEXT,
  FOREIGN KEY(customerId) REFERENCES customers(id)
);
`);

const NS_PER_DAY = 24n * 3600n * 1000000000n;
const nowNs = () => (BigInt(Date.now()) * 1000000n).toString();

const rowCustomer = (c) => ({ id: String(c.id), name: c.name, mobile: c.mobile, createdAt: String(c.createdAt) });
const rowProduct = (p) => ({ id: String(p.id), name: p.name, price: p.price, barcode: p.barcode, createdAt: String(p.createdAt) });
const rowTransaction = (t) => ({
  id: String(t.id),
  customerId: String(t.customerId),
  productName: t.productName,
  note: t.note,
  amount: t.amount,
  txType: t.txType,
  timestamp: String(t.timestamp),
  itemsJson: t.itemsJson ?? null,
});

function getCustomerBalance(customer) {
  const sums = db.prepare(`SELECT
      SUM(CASE WHEN txType = 'udhaar' THEN amount ELSE 0 END) AS totalUdhaar,
      SUM(CASE WHEN txType = 'payment' THEN amount ELSE 0 END) AS totalPaid,
      MAX(CASE WHEN txType = 'payment' THEN timestamp ELSE 0 END) AS lastPaymentDate
    FROM transactions WHERE customerId = ?`).get(customer.id);

  const totalUdhaar = sums.totalUdhaar ?? 0;
  const totalPaid = sums.totalPaid ?? 0;
  const lastPaymentDate = String(sums.lastPaymentDate ?? 0);

  return { totalUdhaar, totalPaid, remainingBalance: totalUdhaar - totalPaid, lastPaymentDate, customer: rowCustomer(customer) };
}

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/backend/:method", (req, res) => {
  const { method } = req.params;
  const b = req.body ?? {};

  try {
    if (method === "addCustomer") {
      if (!b.mobile || String(b.mobile).length === 0) return res.json(null);
      if (db.prepare("SELECT id FROM customers WHERE mobile = ?").get(b.mobile)) return res.json(null);
      const id = Number(db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM customers").get().id);
      const createdAt = nowNs();
      db.prepare("INSERT INTO customers (id, name, mobile, createdAt) VALUES (?, ?, ?, ?)").run(id, b.name, b.mobile, createdAt);
      return res.json(rowCustomer({ id, name: b.name, mobile: b.mobile, createdAt }));
    }
    if (method === "updateCustomer") {
      if (!b.mobile || String(b.mobile).length === 0) return res.json(false);
      if (!db.prepare("SELECT * FROM customers WHERE id = ?").get(Number(b.id))) return res.json(false);
      if (db.prepare("SELECT id FROM customers WHERE mobile = ? AND id != ?").get(b.mobile, Number(b.id))) return res.json(false);
      db.prepare("UPDATE customers SET name = ?, mobile = ? WHERE id = ?").run(b.name, b.mobile, Number(b.id));
      return res.json(true);
    }
    if (method === "deleteCustomer") return res.json(db.prepare("DELETE FROM customers WHERE id = ?").run(Number(b.id)).changes > 0);
    if (method === "getAllCustomers") return res.json(db.prepare("SELECT * FROM customers").all().map(getCustomerBalance));
    if (method === "searchCustomers") {
      const term = `%${b.term ?? ""}%`;
      return res.json(db.prepare("SELECT * FROM customers WHERE name LIKE ? OR mobile LIKE ?").all(term, term).map(rowCustomer));
    }

    if (method === "addProduct") {
      if (db.prepare("SELECT id FROM products WHERE barcode = ?").get(b.barcode)) return res.json(null);
      const id = Number(db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM products").get().id);
      const createdAt = nowNs();
      db.prepare("INSERT INTO products (id, name, price, barcode, createdAt) VALUES (?, ?, ?, ?, ?)").run(id, b.name, b.price, b.barcode, createdAt);
      return res.json(rowProduct({ id, name: b.name, price: b.price, barcode: b.barcode, createdAt }));
    }
    if (method === "updateProduct") {
      if (!db.prepare("SELECT * FROM products WHERE id = ?").get(Number(b.id))) return res.json(false);
      db.prepare("UPDATE products SET name = ?, price = ?, barcode = ? WHERE id = ?").run(b.name, b.price, b.barcode, Number(b.id));
      return res.json(true);
    }
    if (method === "deleteProduct") return res.json(db.prepare("DELETE FROM products WHERE id = ?").run(Number(b.id)).changes > 0);
    if (method === "getAllProducts") return res.json(db.prepare("SELECT * FROM products").all().map(rowProduct));
    if (method === "bulkImportProducts") {
      let added = 0;
      let skipped = 0;
      for (const product of b.productList || []) {
        if (db.prepare("SELECT id FROM products WHERE barcode = ?").get(product.barcode)) {
          skipped += 1;
          continue;
        }
        const id = Number(db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM products").get().id);
        db.prepare("INSERT INTO products (id, name, price, barcode, createdAt) VALUES (?, ?, ?, ?, ?)").run(id, product.name, product.price, product.barcode, nowNs());
        added += 1;
      }
      return res.json([String(added), String(skipped)]);
    }
    if (method === "searchProducts") {
      const term = `%${b.term ?? ""}%`;
      return res.json(db.prepare("SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? ORDER BY id ASC").all(term, term).map(rowProduct));
    }

    if (method === "addTransaction") {
      if (!db.prepare("SELECT id FROM customers WHERE id = ?").get(Number(b.customerId))) return res.json(null);
      const id = Number(db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM transactions").get().id);
      const timestamp = nowNs();
      db.prepare("INSERT INTO transactions (id, customerId, productName, note, amount, txType, timestamp, itemsJson) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)")
        .run(id, Number(b.customerId), b.productName, b.note, b.amount, b.txType, timestamp);
      return res.json(rowTransaction({ id, customerId: b.customerId, productName: b.productName, note: b.note, amount: b.amount, txType: b.txType, timestamp, itemsJson: null }));
    }
    if (method === "addBatchTransaction") {
      if (!db.prepare("SELECT id FROM customers WHERE id = ?").get(Number(b.customerId))) return res.json(null);
      const id = Number(db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM transactions").get().id);
      const timestamp = nowNs();
      db.prepare("INSERT INTO transactions (id, customerId, productName, note, amount, txType, timestamp, itemsJson) VALUES (?, ?, 'Batch', ?, ?, 'udhaar', ?, ?)")
        .run(id, Number(b.customerId), b.note, b.totalAmount, timestamp, b.itemsJson);
      return res.json(rowTransaction({ id, customerId: b.customerId, productName: "Batch", note: b.note, amount: b.totalAmount, txType: "udhaar", timestamp, itemsJson: b.itemsJson }));
    }
    if (method === "deleteTransaction") return res.json(db.prepare("DELETE FROM transactions WHERE id = ?").run(Number(b.id)).changes > 0);
    if (method === "getTransactionsForCustomer") return res.json(db.prepare("SELECT * FROM transactions WHERE customerId = ? ORDER BY timestamp ASC").all(Number(b.customerId)).map(rowTransaction));

    if (method === "getCustomerBalanceSummary") {
      const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(Number(b.customerId));
      return res.json(customer ? getCustomerBalance(customer) : null);
    }
    if (method === "getCustomersSortedByBalance") return res.json(db.prepare("SELECT * FROM customers").all().map(getCustomerBalance).sort((a, c) => c.remainingBalance - a.remainingBalance));
    if (method === "getHighBalanceCustomers") return res.json(db.prepare("SELECT * FROM customers").all().map(getCustomerBalance).filter((x) => x.remainingBalance > Number(b.threshold)));
    if (method === "getInactiveCustomers") {
      const days = Number(b.days);
      const now = BigInt(nowNs());
      const data = db.prepare("SELECT * FROM customers").all().map(getCustomerBalance).filter((cb) => {
        const lastPaymentDate = BigInt(cb.lastPaymentDate);
        const daysSincePayment = lastPaymentDate === 0n ? days + 1 : Number((now - lastPaymentDate) / NS_PER_DAY);
        return daysSincePayment > days;
      });
      return res.json(data);
    }

    return res.status(404).json({ error: `Unknown method: ${method}` });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

if (HAS_FRONTEND_DIST) {
  app.use(express.static(FRONTEND_DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/health") {
      return next();
    }
    return res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
