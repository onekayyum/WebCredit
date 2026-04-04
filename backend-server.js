import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import multer from "multer";
import csvParser from "csv-parser";

const app = express();
const PORT = Number(process.env.PORT || 3001);
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "app.db");
const JWT_SECRET = process.env.JWT_SECRET || "dev-change-me";
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const IMPORT_BATCH_SIZE = Number(process.env.IMPORT_BATCH_SIZE || 500);
const MAX_NAME_LENGTH = 200;

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const FRONTEND_DIST = path.join(process.cwd(), "src", "frontend", "dist");
const HAS_FRONTEND_DIST = fs.existsSync(path.join(FRONTEND_DIST, "index.html"));

const NS_PER_DAY = 24n * 3600n * 1000000000n;
const nowNs = () => (BigInt(Date.now()) * 1000000n).toString();

const upload = multer({
  dest: path.join(process.cwd(), "tmp", "uploads"),
  limits: { fileSize: 30 * 1024 * 1024 },
});

function createToken(user) {
  return jwt.sign({ sub: String(user.id), username: user.username }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

function validateSignupPayload(payload) {
  const username = String(payload?.username ?? "").trim();
  const password = String(payload?.password ?? "");

  if (username.length < 3 || username.length > 50) {
    return { ok: false, error: "username must be between 3 and 50 characters" };
  }
  if (password.length < 8 || password.length > 128) {
    return { ok: false, error: "password must be between 8 and 128 characters" };
  }

  return { ok: true, username, password };
}

function validateProductRow(input) {
  const name = String(input?.name ?? "").trim();
  const barcode = String(input?.barcode ?? "").trim();
  const price = Number(input?.price);

  if (
    !name ||
    name.length > MAX_NAME_LENGTH ||
    !barcode ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return null;
  }

  return { name, price, barcode };
}

function ensureUsersTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

}

function addUserIdColumnIfMissing(tableName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasUserId = columns.some((column) => column.name === "user_id");

  if (!hasUserId) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN user_id INTEGER`);
  }
}

function recreateTableWithoutGlobalUnique({
  tableName,
  createSql,
  columnList,
  copySelect,
}) {
  const tableRow = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  if (!tableRow?.sql) return;
  if (!tableRow.sql.includes("UNIQUE")) return;

  db.exec(`
    ALTER TABLE ${tableName} RENAME TO ${tableName}_old;
    ${createSql}
    INSERT INTO ${tableName} (${columnList.join(", ")})
    SELECT ${copySelect}
    FROM ${tableName}_old;
    DROP TABLE ${tableName}_old;
  `);
}

function initializeSchema() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    user_id INTEGER
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    barcode TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    user_id INTEGER
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
    user_id INTEGER,
    FOREIGN KEY(customerId) REFERENCES customers(id)
  );
  `);

  addUserIdColumnIfMissing("customers");
  addUserIdColumnIfMissing("products");
  addUserIdColumnIfMissing("transactions");

  recreateTableWithoutGlobalUnique({
    tableName: "customers",
    createSql: `CREATE TABLE customers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      user_id INTEGER
    );`,
    columnList: ["id", "name", "mobile", "createdAt", "user_id"],
    copySelect: "id, name, mobile, createdAt, user_id",
  });
  recreateTableWithoutGlobalUnique({
    tableName: "products",
    createSql: `CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      barcode TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      user_id INTEGER
    );`,
    columnList: ["id", "name", "price", "barcode", "createdAt", "user_id"],
    copySelect: "id, name, price, barcode, createdAt, user_id",
  });

  ensureUsersTable();

  db.exec("CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_user_barcode ON products(user_id, barcode)");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_mobile ON customers(user_id, mobile)");
}

initializeSchema();

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

function getCustomerBalance(customer, userId) {
  const sums = db.prepare(`SELECT
      SUM(CASE WHEN txType = 'udhaar' THEN amount ELSE 0 END) AS totalUdhaar,
      SUM(CASE WHEN txType = 'payment' THEN amount ELSE 0 END) AS totalPaid,
      MAX(CASE WHEN txType = 'payment' THEN timestamp ELSE 0 END) AS lastPaymentDate
    FROM transactions WHERE customerId = ? AND user_id = ?`).get(customer.id, userId);

  const totalUdhaar = sums.totalUdhaar ?? 0;
  const totalPaid = sums.totalPaid ?? 0;
  const lastPaymentDate = String(sums.lastPaymentDate ?? 0);

  return { totalUdhaar, totalPaid, remainingBalance: totalUdhaar - totalPaid, lastPaymentDate, customer: rowCustomer(customer) };
}

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false }));
app.get("/health", (_req, res) => res.json({ ok: true }));
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
const importRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

function authMiddleware(req, res, next) {
  const authHeader = req.header("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = Number(decoded.sub);
    const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(userId);
    if (!user) {
      return res.status(401).json({ error: "Invalid token user" });
    }
    req.user = { id: user.id, username: user.username };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.post("/auth/signup", authRateLimiter, async (req, res) => {
  const validation = validateSignupPayload(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(validation.username);
  if (existing) {
    return res.status(409).json({ error: "username already exists" });
  }
  const userCount = Number(db.prepare("SELECT COUNT(*) AS count FROM users").get().count);

  const id = Number(db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM users").get().id);
  const createdAt = nowNs();
  const hashed = await bcrypt.hash(validation.password, BCRYPT_ROUNDS);
  db.prepare("INSERT INTO users (id, username, password, createdAt) VALUES (?, ?, ?, ?)").run(
    id,
    validation.username,
    hashed,
    createdAt,
  );
  if (userCount === 0) {
    db.prepare("UPDATE customers SET user_id = ? WHERE user_id IS NULL").run(id);
    db.prepare("UPDATE products SET user_id = ? WHERE user_id IS NULL").run(id);
    db.prepare("UPDATE transactions SET user_id = ? WHERE user_id IS NULL").run(id);
  }

  const token = createToken({ id, username: validation.username });
  return res.status(201).json({ token, user: { id: String(id), username: validation.username } });
});

app.post("/auth/login", authRateLimiter, async (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");

  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const token = createToken(user);
  return res.json({ token, user: { id: String(user.id), username: user.username } });
});

app.get("/products/export", authMiddleware, (req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="products.csv"');

  res.write("name,price,barcode\n");

  const stmt = db.prepare("SELECT name, price, barcode FROM products WHERE user_id = ? ORDER BY id ASC");
  for (const row of stmt.iterate(req.user.id)) {
    const escapedName = `"${String(row.name).replaceAll('"', '""')}"`;
    const escapedBarcode = `"${String(row.barcode).replaceAll('"', '""')}"`;
    res.write(`${escapedName},${row.price},${escapedBarcode}\n`);
  }

  res.end();
});

app.post("/products/import", importRateLimiter, authMiddleware, upload.single("file"), (req, res) => {
  if (!req.file?.path) {
    return res.status(400).json({ error: "CSV file is required as form-data field 'file'" });
  }

  const filePath = req.file.path;
  const userId = req.user.id;

  const insertOrUpdateMany = db.transaction((rows) => {
    const upsert = db.prepare(`
      INSERT INTO products (id, name, price, barcode, createdAt, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, barcode)
      DO UPDATE SET name = excluded.name, price = excluded.price
    `);

    for (const row of rows) {
      const existing = db
        .prepare("SELECT id FROM products WHERE user_id = ? AND barcode = ?")
        .get(userId, row.barcode);
      const id = Number(db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM products").get().id);
      upsert.run(id, row.name, row.price, row.barcode, nowNs(), userId);
      if (existing) {
        row.__updated = true;
      }
    }
  });

  let totalRows = 0;
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let currentBatch = [];

  const flush = () => {
    if (currentBatch.length === 0) return;
    insertOrUpdateMany(currentBatch);
    for (const row of currentBatch) {
      if (row.__updated) updated += 1;
      else imported += 1;
    }
    currentBatch = [];
  };

  const parser = fs
    .createReadStream(filePath)
    .pipe(csvParser({ mapHeaders: ({ header }) => String(header || "").trim().toLowerCase() }));

  parser.on("data", (row) => {
    totalRows += 1;
    const normalized = validateProductRow(row);
    if (!normalized) {
      skipped += 1;
      return;
    }

    currentBatch.push(normalized);
    if (currentBatch.length >= IMPORT_BATCH_SIZE) {
      flush();
    }
  });

  parser.on("end", () => {
    try {
      flush();
      fs.unlink(filePath, () => {});
      return res.json({ totalRows, imported, updated, skipped });
    } catch (error) {
      fs.unlink(filePath, () => {});
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  parser.on("error", (error) => {
    fs.unlink(filePath, () => {});
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  });
});

app.post("/api/backend/:method", authMiddleware, (req, res) => {
  const { method } = req.params;
  const b = req.body ?? {};
  const userId = req.user.id;

  try {
    if (method === "addCustomer") {
      const name = String(b.name ?? "").trim();
      const mobile = String(b.mobile ?? "").trim();

      if (mobile.length === 0) return res.json(null);
      if (db.prepare("SELECT id FROM customers WHERE mobile = ? AND user_id = ?").get(mobile, userId)) return res.json(null);

      const id = Number(
        db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM customers").get().id,
      );
      const createdAt = nowNs();

      try {
        db.prepare(
          "INSERT INTO customers (id, name, mobile, createdAt, user_id) VALUES (?, ?, ?, ?, ?)",
        ).run(id, name, mobile, createdAt, userId);
      } catch (error) {
        const message = String(error);
        if (message.includes("UNIQUE constraint failed: customers.mobile") || message.includes("idx_customers_user_mobile")) {
          return res.json(null);
        }
        throw error;
      }

      return res.json(rowCustomer({ id, name, mobile, createdAt }));
    }
    if (method === "updateCustomer") {
      const name = String(b.name ?? "").trim();
      const mobile = String(b.mobile ?? "").trim();

      if (mobile.length === 0) return res.json(false);
      if (!db.prepare("SELECT * FROM customers WHERE id = ? AND user_id = ?").get(Number(b.id), userId)) return res.json(false);
      if (db.prepare("SELECT id FROM customers WHERE mobile = ? AND id != ? AND user_id = ?").get(mobile, Number(b.id), userId)) return res.json(false);

      db.prepare("UPDATE customers SET name = ?, mobile = ? WHERE id = ? AND user_id = ?").run(name, mobile, Number(b.id), userId);
      return res.json(true);
    }
    if (method === "deleteCustomer") return res.json(db.prepare("DELETE FROM customers WHERE id = ? AND user_id = ?").run(Number(b.id), userId).changes > 0);
    if (method === "getAllCustomers") return res.json(db.prepare("SELECT * FROM customers WHERE user_id = ?").all(userId).map((c) => getCustomerBalance(c, userId)));
    if (method === "searchCustomers") {
      const term = `%${b.term ?? ""}%`;
      return res.json(db.prepare("SELECT * FROM customers WHERE user_id = ? AND (name LIKE ? OR mobile LIKE ?)").all(userId, term, term).map(rowCustomer));
    }

    if (method === "addProduct") {
      if (db.prepare("SELECT id FROM products WHERE barcode = ? AND user_id = ?").get(b.barcode, userId)) return res.json(null);
      const id = Number(db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM products").get().id);
      const createdAt = nowNs();
      db.prepare("INSERT INTO products (id, name, price, barcode, createdAt, user_id) VALUES (?, ?, ?, ?, ?, ?)").run(id, b.name, b.price, b.barcode, createdAt, userId);
      return res.json(rowProduct({ id, name: b.name, price: b.price, barcode: b.barcode, createdAt }));
    }
    if (method === "updateProduct") {
      if (!db.prepare("SELECT * FROM products WHERE id = ? AND user_id = ?").get(Number(b.id), userId)) return res.json(false);
      db.prepare("UPDATE products SET name = ?, price = ?, barcode = ? WHERE id = ? AND user_id = ?").run(b.name, b.price, b.barcode, Number(b.id), userId);
      return res.json(true);
    }
    if (method === "deleteProduct") return res.json(db.prepare("DELETE FROM products WHERE id = ? AND user_id = ?").run(Number(b.id), userId).changes > 0);
    if (method === "getAllProducts") return res.json(db.prepare("SELECT * FROM products WHERE user_id = ?").all(userId).map(rowProduct));
    if (method === "bulkImportProducts") {
      let added = 0;
      let skipped = 0;
      const importRows = [];

      for (const product of b.productList || []) {
        const normalized = validateProductRow(product);
        if (!normalized) {
          skipped += 1;
          continue;
        }
        importRows.push(normalized);
      }

      const tx = db.transaction((rows) => {
        const upsert = db.prepare(`
          INSERT INTO products (id, name, price, barcode, createdAt, user_id)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, barcode)
          DO UPDATE SET name = excluded.name, price = excluded.price
        `);

        for (const row of rows) {
          const exists = db.prepare("SELECT id FROM products WHERE barcode = ? AND user_id = ?").get(row.barcode, userId);
          const id = exists?.id ?? Number(db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM products").get().id);
          upsert.run(id, row.name, row.price, row.barcode, nowNs(), userId);
          if (exists) {
            skipped += 1;
          } else {
            added += 1;
          }
        }
      });
      tx(importRows);

      return res.json([String(added), String(skipped)]);
    }
    if (method === "searchProducts") {
      const term = `%${b.term ?? ""}%`;
      return res.json(db.prepare("SELECT * FROM products WHERE user_id = ? AND (name LIKE ? OR barcode LIKE ?) ORDER BY id ASC").all(userId, term, term).map(rowProduct));
    }

    if (method === "addTransaction") {
      if (!db.prepare("SELECT id FROM customers WHERE id = ? AND user_id = ?").get(Number(b.customerId), userId)) return res.json(null);
      const id = Number(db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM transactions").get().id);
      const timestamp = nowNs();
      db.prepare("INSERT INTO transactions (id, customerId, productName, note, amount, txType, timestamp, itemsJson, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)")
        .run(id, Number(b.customerId), b.productName, b.note, b.amount, b.txType, timestamp, userId);
      return res.json(rowTransaction({ id, customerId: b.customerId, productName: b.productName, note: b.note, amount: b.amount, txType: b.txType, timestamp, itemsJson: null }));
    }
    if (method === "addBatchTransaction") {
      if (!db.prepare("SELECT id FROM customers WHERE id = ? AND user_id = ?").get(Number(b.customerId), userId)) return res.json(null);
      const id = Number(db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM transactions").get().id);
      const timestamp = nowNs();
      db.prepare("INSERT INTO transactions (id, customerId, productName, note, amount, txType, timestamp, itemsJson, user_id) VALUES (?, ?, 'Batch', ?, ?, 'udhaar', ?, ?, ?)")
        .run(id, Number(b.customerId), b.note, b.totalAmount, timestamp, b.itemsJson, userId);
      return res.json(rowTransaction({ id, customerId: b.customerId, productName: "Batch", note: b.note, amount: b.totalAmount, txType: "udhaar", timestamp, itemsJson: b.itemsJson }));
    }
    if (method === "deleteTransaction") return res.json(db.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?").run(Number(b.id), userId).changes > 0);
    if (method === "getTransactionsForCustomer") return res.json(db.prepare("SELECT * FROM transactions WHERE customerId = ? AND user_id = ? ORDER BY timestamp ASC").all(Number(b.customerId), userId).map(rowTransaction));

    if (method === "getCustomerBalanceSummary") {
      const customer = db.prepare("SELECT * FROM customers WHERE id = ? AND user_id = ?").get(Number(b.customerId), userId);
      return res.json(customer ? getCustomerBalance(customer, userId) : null);
    }
    if (method === "getCustomersSortedByBalance") return res.json(db.prepare("SELECT * FROM customers WHERE user_id = ?").all(userId).map((c) => getCustomerBalance(c, userId)).sort((a, c) => c.remainingBalance - a.remainingBalance));
    if (method === "getHighBalanceCustomers") return res.json(db.prepare("SELECT * FROM customers WHERE user_id = ?").all(userId).map((c) => getCustomerBalance(c, userId)).filter((x) => x.remainingBalance > Number(b.threshold)));
    if (method === "getInactiveCustomers") {
      const days = Number(b.days);
      const now = BigInt(nowNs());
      const data = db.prepare("SELECT * FROM customers WHERE user_id = ?").all(userId).map((c) => getCustomerBalance(c, userId)).filter((cb) => {
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
    if (req.path.startsWith("/api/") || req.path === "/health" || req.path.startsWith("/auth/") || req.path.startsWith("/products/")) {
      return next();
    }
    return res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
