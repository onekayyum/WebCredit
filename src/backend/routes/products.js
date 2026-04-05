import { Router } from "express";
import multer from "multer";
import csvParser from "csv-parser";
import fs from "node:fs";
import path from "node:path";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { importRateLimiter } from "../middleware/rateLimiter.js";
import { nowNs, validateProductRow, rowProduct } from "../utils/helpers.js";

const IMPORT_BATCH_SIZE = Number(process.env.IMPORT_BATCH_SIZE || 500);

const upload = multer({
  dest: path.join(process.cwd(), "tmp", "uploads"),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

router.get("/export", authMiddleware, (req, res) => {
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

router.post("/import", importRateLimiter, authMiddleware, upload.single("file"), (req, res) => {
  if (!req.file?.path) {
    return res.status(400).json({ error: "CSV file is required as form-data field 'file'" });
  }

  const filePath = req.file.path;
  const userId = req.user.id;
  const importInfo = db.prepare(
    "INSERT INTO imports (user_id, status, total_rows, processed_rows, created_at) VALUES (?, 'processing', 0, 0, ?)",
  ).run(userId, nowNs());
  const importId = Number(importInfo.lastInsertRowid);

  const insertOrUpdateMany = db.transaction((rows) => {
    const upsert = db.prepare(`
      INSERT INTO products (name, price, barcode, createdAt, user_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, barcode)
      DO UPDATE SET name = excluded.name, price = excluded.price
    `);

    for (const row of rows) {
      const existing = db
        .prepare("SELECT id FROM products WHERE user_id = ? AND barcode = ?")
        .get(userId, row.barcode);
      upsert.run(row.name, row.price, row.barcode, nowNs(), userId);
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
    db.prepare("UPDATE imports SET processed_rows = ?, total_rows = ? WHERE id = ?")
      .run(imported + updated + skipped, totalRows, importId);
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
      db.prepare("UPDATE imports SET status = 'completed', total_rows = ?, processed_rows = ? WHERE id = ?")
        .run(totalRows, imported + updated + skipped, importId);
      return res.json({ totalRows, imported, updated, skipped });
    } catch (error) {
      fs.unlink(filePath, () => {});
      db.prepare("UPDATE imports SET status = 'failed', total_rows = ?, processed_rows = ? WHERE id = ?")
        .run(totalRows, imported + updated + skipped, importId);
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  parser.on("error", (error) => {
    fs.unlink(filePath, () => {});
    db.prepare("UPDATE imports SET status = 'failed', total_rows = ?, processed_rows = ? WHERE id = ?")
      .run(totalRows, imported + updated + skipped, importId);
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  });
});

export default router;
export { rowProduct };
