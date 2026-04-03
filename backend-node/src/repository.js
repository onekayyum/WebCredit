import sqlite3 from "sqlite3";
import { open } from "sqlite";

const NS_PER_MS = 1_000_000n;
const DAY_IN_NS = 24n * 3600n * 1_000_000_000n;

const toBigInt = (value) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string") return BigInt(value);
  return 0n;
};

const nowNs = () => BigInt(Date.now()) * NS_PER_MS;

function toCustomer(row) {
  return {
    id: BigInt(row.id),
    name: row.name,
    mobile: row.mobile,
    createdAt: toBigInt(row.created_at),
  };
}

function toProduct(row) {
  return {
    id: BigInt(row.id),
    name: row.name,
    price: row.price,
    barcode: row.barcode,
    createdAt: toBigInt(row.created_at),
  };
}

function toTransaction(row) {
  return {
    id: BigInt(row.id),
    customerId: BigInt(row.customer_id),
    productName: row.product_name,
    note: row.note,
    amount: row.amount,
    txType: row.tx_type,
    timestamp: toBigInt(row.timestamp),
    itemsJson: row.items_json ?? undefined,
  };
}

export async function createRepository(dbPath = "./backend-node/data.sqlite") {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      barcode TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      note TEXT NOT NULL,
      amount REAL NOT NULL,
      tx_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      items_json TEXT,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );
  `);

  async function getCustomerBalance(customer) {
    const rows = await db.all(
      `SELECT amount, tx_type, timestamp FROM transactions WHERE customer_id = ?`,
      [customer.id],
    );

    let totalUdhaar = 0;
    let totalPaid = 0;
    let lastPaymentDate = 0n;

    for (const row of rows) {
      if (row.tx_type === "udhaar") totalUdhaar += row.amount;
      if (row.tx_type === "payment") {
        totalPaid += row.amount;
        const ts = toBigInt(row.timestamp);
        if (ts > lastPaymentDate) lastPaymentDate = ts;
      }
    }

    return {
      totalUdhaar,
      totalPaid,
      remainingBalance: totalUdhaar - totalPaid,
      lastPaymentDate,
      customer,
    };
  }

  return {
    async addCustomer(name, mobile) {
      if (!mobile || mobile.length === 0) return null;

      const exists = await db.get(`SELECT id FROM customers WHERE mobile = ?`, [mobile]);
      if (exists) return null;

      const createdAt = nowNs().toString();
      const result = await db.run(
        `INSERT INTO customers (name, mobile, created_at) VALUES (?, ?, ?)`,
        [name, mobile, createdAt],
      );

      const row = await db.get(`SELECT * FROM customers WHERE id = ?`, [result.lastID]);
      return toCustomer(row);
    },

    async updateCustomer(id, name, mobile) {
      if (!mobile || mobile.length === 0) return false;
      const customerId = Number(id);
      const mobileExists = await db.get(
        `SELECT id FROM customers WHERE mobile = ? AND id != ?`,
        [mobile, customerId],
      );
      if (mobileExists) return false;

      const existing = await db.get(`SELECT * FROM customers WHERE id = ?`, [customerId]);
      if (!existing) return false;

      await db.run(
        `UPDATE customers SET name = ?, mobile = ? WHERE id = ?`,
        [name, mobile, customerId],
      );
      return true;
    },

    async deleteCustomer(id) {
      const result = await db.run(`DELETE FROM customers WHERE id = ?`, [Number(id)]);
      return result.changes > 0;
    },

    async getAllCustomers() {
      const rows = await db.all(`SELECT * FROM customers`);
      const balances = [];
      for (const row of rows) {
        balances.push(await getCustomerBalance(toCustomer(row)));
      }
      return balances;
    },

    async searchCustomers(term) {
      const like = `%${term}%`;
      const rows = await db.all(
        `SELECT * FROM customers WHERE name LIKE ? OR mobile LIKE ?`,
        [like, like],
      );
      return rows.map(toCustomer);
    },

    async addProduct(name, price, barcode) {
      const exists = await db.get(`SELECT id FROM products WHERE barcode = ?`, [barcode]);
      if (exists) return null;

      const createdAt = nowNs().toString();
      const result = await db.run(
        `INSERT INTO products (name, price, barcode, created_at) VALUES (?, ?, ?, ?)`,
        [name, price, barcode, createdAt],
      );
      const row = await db.get(`SELECT * FROM products WHERE id = ?`, [result.lastID]);
      return toProduct(row);
    },

    async updateProduct(id, name, price, barcode) {
      const productId = Number(id);
      const existing = await db.get(`SELECT * FROM products WHERE id = ?`, [productId]);
      if (!existing) return false;

      await db.run(
        `UPDATE products SET name = ?, price = ?, barcode = ? WHERE id = ?`,
        [name, price, barcode, productId],
      );
      return true;
    },

    async deleteProduct(id) {
      const result = await db.run(`DELETE FROM products WHERE id = ?`, [Number(id)]);
      return result.changes > 0;
    },

    async getAllProducts() {
      const rows = await db.all(`SELECT * FROM products`);
      return rows.map(toProduct);
    },

    async bulkImportProducts(productList) {
      let added = 0;
      let skipped = 0;
      for (const product of productList) {
        const exists = await db.get(`SELECT id FROM products WHERE barcode = ?`, [product.barcode]);
        if (exists) {
          skipped += 1;
          continue;
        }

        await db.run(
          `INSERT INTO products (name, price, barcode, created_at) VALUES (?, ?, ?, ?)`,
          [product.name, product.price, product.barcode, nowNs().toString()],
        );
        added += 1;
      }

      return [BigInt(added), BigInt(skipped)];
    },

    async searchProducts(term) {
      const like = `%${term}%`;
      const rows = await db.all(
        `SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? ORDER BY id ASC`,
        [like, like],
      );
      return rows.map(toProduct);
    },

    async addTransaction(customerId, productName, note, amount, txType) {
      const customer = await db.get(`SELECT id FROM customers WHERE id = ?`, [Number(customerId)]);
      if (!customer) return null;

      const result = await db.run(
        `INSERT INTO transactions (customer_id, product_name, note, amount, tx_type, timestamp, items_json)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
        [Number(customerId), productName, note, amount, txType, nowNs().toString()],
      );
      const row = await db.get(`SELECT * FROM transactions WHERE id = ?`, [result.lastID]);
      return toTransaction(row);
    },

    async addBatchTransaction(customerId, totalAmount, itemsJson, note) {
      const customer = await db.get(`SELECT id FROM customers WHERE id = ?`, [Number(customerId)]);
      if (!customer) return null;

      const result = await db.run(
        `INSERT INTO transactions (customer_id, product_name, note, amount, tx_type, timestamp, items_json)
         VALUES (?, 'Batch', ?, ?, 'udhaar', ?, ?)`,
        [Number(customerId), note, totalAmount, nowNs().toString(), itemsJson],
      );
      const row = await db.get(`SELECT * FROM transactions WHERE id = ?`, [result.lastID]);
      return toTransaction(row);
    },

    async deleteTransaction(id) {
      const result = await db.run(`DELETE FROM transactions WHERE id = ?`, [Number(id)]);
      return result.changes > 0;
    },

    async getTransactionsForCustomer(customerId) {
      const rows = await db.all(
        `SELECT * FROM transactions WHERE customer_id = ? ORDER BY timestamp ASC`,
        [Number(customerId)],
      );
      return rows.map(toTransaction);
    },

    async getCustomerBalanceSummary(customerId) {
      const row = await db.get(`SELECT * FROM customers WHERE id = ?`, [Number(customerId)]);
      if (!row) return null;
      return getCustomerBalance(toCustomer(row));
    },

    async getCustomersSortedByBalance() {
      const balances = await this.getAllCustomers();
      return balances.sort((a, b) => b.remainingBalance - a.remainingBalance);
    },

    async getHighBalanceCustomers(threshold) {
      const balances = await this.getAllCustomers();
      return balances.filter((b) => b.remainingBalance > threshold);
    },

    async getInactiveCustomers(days) {
      const now = nowNs();
      const daysBigInt = toBigInt(days);
      const balances = await this.getAllCustomers();
      return balances.filter((cb) => {
        const daysSincePayment =
          cb.lastPaymentDate === 0n
            ? daysBigInt + 1n
            : (now - cb.lastPaymentDate) / DAY_IN_NS;
        return daysSincePayment > daysBigInt;
      });
    },
  };
}
