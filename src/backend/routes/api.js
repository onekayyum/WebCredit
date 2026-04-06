import { Router } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  nowNs,
  NS_PER_DAY,
  validateProductRow,
  validateCustomerInput,
  validateTransactionInput,
  rowCustomer,
  rowProduct,
  rowTransaction,
} from "../utils/helpers.js";

const router = Router();
const MAX_BULK_IMPORT_ROWS = Number(process.env.MAX_BULK_IMPORT_ROWS || 100000);
const BULK_IMPORT_CHUNK_SIZE = Number(process.env.BULK_IMPORT_CHUNK_SIZE || 1000);

function getCustomerBalance(customer, userId) {
  const sums = db
    .prepare(
      `SELECT
        SUM(CASE WHEN txType = 'udhaar' THEN amount ELSE 0 END) AS totalUdhaar,
        SUM(CASE WHEN txType = 'payment' THEN amount ELSE 0 END) AS totalPaid,
        MAX(CASE WHEN txType = 'payment' THEN timestamp ELSE 0 END) AS lastPaymentDate
      FROM transactions WHERE customerId = ? AND user_id = ?`,
    )
    .get(customer.id, userId);

  const totalUdhaar = sums.totalUdhaar ?? 0;
  const totalPaid = sums.totalPaid ?? 0;
  const lastPaymentDate = String(sums.lastPaymentDate ?? 0);

  return {
    totalUdhaar,
    totalPaid,
    remainingBalance: totalUdhaar - totalPaid,
    lastPaymentDate,
    customer: rowCustomer(customer),
  };
}

router.post("/:method", authMiddleware, (req, res) => {
  const { method } = req.params;
  const b = req.body ?? {};
  const userId = req.user.id;

  const parseLimit = (defaultLimit, maxLimit = 10000) =>
    Math.min(Math.max(Number(b.limit) || defaultLimit, 1), maxLimit);
  const offset = Math.max(Number(b.offset) || 0, 0);

  try {
    // ── Customers ──────────────────────────────────────────────
    if (method === "addCustomer") {
      const v = validateCustomerInput(b);
      if (!v.ok) return res.json(null);

      if (
        db
          .prepare("SELECT id FROM customers WHERE mobile = ? AND user_id = ?")
          .get(v.mobile, userId)
      )
        return res.json(null);

      const createdAt = nowNs();

      try {
        const info = db
          .prepare(
            "INSERT INTO customers (name, mobile, createdAt, user_id) VALUES (?, ?, ?, ?)",
          )
          .run(v.name, v.mobile, createdAt, userId);

        return res.json(
          rowCustomer({ id: Number(info.lastInsertRowid), name: v.name, mobile: v.mobile, createdAt }),
        );
      } catch (error) {
        const message = String(error);
        if (
          message.includes("UNIQUE constraint failed: customers.mobile") ||
          message.includes("idx_customers_user_mobile")
        ) {
          return res.json(null);
        }
        throw error;
      }
    }

    if (method === "updateCustomer") {
      const v = validateCustomerInput(b);
      if (!v.ok) return res.json(false);

      if (
        !db
          .prepare("SELECT * FROM customers WHERE id = ? AND user_id = ?")
          .get(Number(b.id), userId)
      )
        return res.json(false);
      if (
        db
          .prepare(
            "SELECT id FROM customers WHERE mobile = ? AND id != ? AND user_id = ?",
          )
          .get(v.mobile, Number(b.id), userId)
      )
        return res.json(false);

      db.prepare(
        "UPDATE customers SET name = ?, mobile = ? WHERE id = ? AND user_id = ?",
      ).run(v.name, v.mobile, Number(b.id), userId);
      return res.json(true);
    }

    if (method === "deleteCustomer")
      return res.json(
        db
          .prepare("DELETE FROM customers WHERE id = ? AND user_id = ?")
          .run(Number(b.id), userId).changes > 0,
      );

    if (method === "getAllCustomers") {
      const limit = parseLimit(10000);
      const rows = db
        .prepare(
          "SELECT * FROM customers WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
        )
        .all(userId, limit, offset);
      return res.json(rows.map((c) => getCustomerBalance(c, userId)));
    }

    if (method === "searchCustomers") {
      const limit = parseLimit(100);
      const term = `%${b.term ?? ""}%`;
      return res.json(
        db
          .prepare(
            "SELECT * FROM customers WHERE user_id = ? AND (name LIKE ? OR mobile LIKE ?) LIMIT ?",
          )
          .all(userId, term, term, limit)
          .map(rowCustomer),
      );
    }

    // ── Products ───────────────────────────────────────────────
    if (method === "addProduct") {
      const validated = validateProductRow(b);
      if (!validated) {
        return res.json(null);
      }

      if (
        db
          .prepare("SELECT id FROM products WHERE barcode = ? AND user_id = ?")
          .get(validated.barcode, userId)
      )
        return res.json(null);

      const createdAt = nowNs();
      const info = db
        .prepare(
          "INSERT INTO products (name, price, barcode, createdAt, user_id) VALUES (?, ?, ?, ?, ?)",
        )
        .run(validated.name, validated.price, validated.barcode, createdAt, userId);

      return res.json(
        rowProduct({
          id: Number(info.lastInsertRowid),
          name: validated.name,
          price: validated.price,
          barcode: validated.barcode,
          createdAt,
        }),
      );
    }

    if (method === "updateProduct") {
      const validated = validateProductRow(b);
      if (!validated) {
        return res.json(false);
      }

      if (
        !db
          .prepare("SELECT * FROM products WHERE id = ? AND user_id = ?")
          .get(Number(b.id), userId)
      )
        return res.json(false);

      db.prepare(
        "UPDATE products SET name = ?, price = ?, barcode = ? WHERE id = ? AND user_id = ?",
      ).run(validated.name, validated.price, validated.barcode, Number(b.id), userId);
      return res.json(true);
    }

    if (method === "deleteProduct")
      return res.json(
        db
          .prepare("DELETE FROM products WHERE id = ? AND user_id = ?")
          .run(Number(b.id), userId).changes > 0,
      );

    if (method === "getAllProducts")
      {
        const limit = parseLimit(10000);
      return res.json(
        db
          .prepare(
            "SELECT * FROM products WHERE user_id = ? ORDER BY id ASC LIMIT ? OFFSET ?",
          )
          .all(userId, limit, offset)
          .map(rowProduct),
      );
      }

    if (method === "bulkImportProducts") {
      let added = 0;
      let skipped = 0;
      const importRows = [];
      const rawProducts = Array.isArray(b.productList) ? b.productList : [];

      if (rawProducts.length > MAX_BULK_IMPORT_ROWS) {
        return res.status(400).json({
          error: `Too many products in one request. Maximum is ${MAX_BULK_IMPORT_ROWS}.`,
        });
      }

      for (const product of rawProducts) {
        const normalized = validateProductRow(product);
        if (!normalized) {
          skipped += 1;
          continue;
        }
        importRows.push(normalized);
      }

      const tx = db.transaction((rows) => {
        const upsert = db.prepare(`
          INSERT INTO products (name, price, barcode, createdAt, user_id)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id, barcode)
          DO UPDATE SET name = excluded.name, price = excluded.price
        `);

        for (const row of rows) {
          const exists = db
            .prepare("SELECT id FROM products WHERE barcode = ? AND user_id = ?")
            .get(row.barcode, userId);
          upsert.run(row.name, row.price, row.barcode, nowNs(), userId);
          if (exists) {
            skipped += 1;
          } else {
            added += 1;
          }
        }
      });
      for (let index = 0; index < importRows.length; index += BULK_IMPORT_CHUNK_SIZE) {
        tx(importRows.slice(index, index + BULK_IMPORT_CHUNK_SIZE));
      }

      return res.json([String(added), String(skipped)]);
    }

    if (method === "searchProducts") {
      const limit = parseLimit(100);
      const term = `%${b.term ?? ""}%`;
      return res.json(
        db
          .prepare(
            "SELECT * FROM products WHERE user_id = ? AND (name LIKE ? OR barcode LIKE ?) ORDER BY id ASC LIMIT ?",
          )
          .all(userId, term, term, limit)
          .map(rowProduct),
      );
    }

    // ── Transactions ───────────────────────────────────────────
    if (method === "addTransaction") {
      const v = validateTransactionInput(b);
      if (!v.ok) {
        // Preserve original behavior: return null on invalid input
        if (
          !db
            .prepare("SELECT id FROM customers WHERE id = ? AND user_id = ?")
            .get(Number(b.customerId), userId)
        )
          return res.json(null);
        return res.json(null);
      }

      if (
        !db
          .prepare("SELECT id FROM customers WHERE id = ? AND user_id = ?")
          .get(v.customerId, userId)
      )
        return res.json(null);

      const timestamp = nowNs();
      const info = db
        .prepare(
          "INSERT INTO transactions (customerId, productName, note, amount, txType, timestamp, itemsJson, user_id) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)",
        )
        .run(v.customerId, v.productName, v.note, v.amount, v.txType, timestamp, userId);

      return res.json(
        rowTransaction({
          id: Number(info.lastInsertRowid),
          customerId: b.customerId,
          productName: v.productName,
          note: v.note,
          amount: v.amount,
          txType: v.txType,
          timestamp,
          itemsJson: null,
        }),
      );
    }

    if (method === "addBatchTransaction") {
      if (
        !db
          .prepare("SELECT id FROM customers WHERE id = ? AND user_id = ?")
          .get(Number(b.customerId), userId)
      )
        return res.json(null);

      const totalAmount = Number(b.totalAmount);
      if (!Number.isFinite(totalAmount) || totalAmount < 0) {
        return res.json(null);
      }

      const timestamp = nowNs();
      const note = String(b.note ?? "").trim();
      const itemsJson = b.itemsJson ?? null;
      const info = db
        .prepare(
          "INSERT INTO transactions (customerId, productName, note, amount, txType, timestamp, itemsJson, user_id) VALUES (?, 'Batch', ?, ?, 'udhaar', ?, ?, ?)",
        )
        .run(Number(b.customerId), note, totalAmount, timestamp, itemsJson, userId);

      return res.json(
        rowTransaction({
          id: Number(info.lastInsertRowid),
          customerId: b.customerId,
          productName: "Batch",
          note,
          amount: totalAmount,
          txType: "udhaar",
          timestamp,
          itemsJson,
        }),
      );
    }

    if (method === "deleteTransaction")
      return res.json(
        db
          .prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?")
          .run(Number(b.id), userId).changes > 0,
      );

    if (method === "getTransactionsForCustomer")
      {
        const limit = parseLimit(500, 5000);
      return res.json(
        db
          .prepare(
            "SELECT * FROM transactions WHERE customerId = ? AND user_id = ? ORDER BY timestamp ASC LIMIT ? OFFSET ?",
          )
          .all(Number(b.customerId), userId, limit, offset)
          .map(rowTransaction),
      );
      }

    // ── Balance / Analytics ────────────────────────────────────
    if (method === "getCustomerBalanceSummary") {
      const customer = db
        .prepare("SELECT * FROM customers WHERE id = ? AND user_id = ?")
        .get(Number(b.customerId), userId);
      return res.json(customer ? getCustomerBalance(customer, userId) : null);
    }

    if (method === "getCustomersSortedByBalance")
      return res.json(
        db
          .prepare("SELECT * FROM customers WHERE user_id = ?")
          .all(userId)
          .map((c) => getCustomerBalance(c, userId))
          .sort((a, c) => c.remainingBalance - a.remainingBalance),
      );

    if (method === "getHighBalanceCustomers")
      return res.json(
        db
          .prepare("SELECT * FROM customers WHERE user_id = ?")
          .all(userId)
          .map((c) => getCustomerBalance(c, userId))
          .filter((x) => x.remainingBalance > Number(b.threshold)),
      );

    if (method === "getInactiveCustomers") {
      const days = Number(b.days);
      const now = BigInt(nowNs());
      const data = db
        .prepare("SELECT * FROM customers WHERE user_id = ?")
        .all(userId)
        .map((c) => getCustomerBalance(c, userId))
        .filter((cb) => {
          const lastPaymentDate = BigInt(cb.lastPaymentDate);
          const daysSincePayment =
            lastPaymentDate === 0n
              ? days + 1
              : Number((now - lastPaymentDate) / NS_PER_DAY);
          return daysSincePayment > days;
        });
      return res.json(data);
    }

    return res.status(404).json({ error: `Unknown method: ${method}` });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
