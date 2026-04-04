import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";

import db from "./db.js";
import { runMigrations } from "./migrations.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { requestLogger } from "./middleware/logger.js";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import settingsRoutes from "./routes/settings.js";
import apiRoutes from "./routes/api.js";

// ── Configuration ──────────────────────────────────────────────
const PORT = Number(process.env.PORT || 3001);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const FRONTEND_DIST = path.join(process.cwd(), "src", "frontend", "dist");
const HAS_FRONTEND_DIST = fs.existsSync(path.join(FRONTEND_DIST, "index.html"));
const TMP_UPLOADS = path.join(process.cwd(), "tmp", "uploads");

// ── Startup ────────────────────────────────────────────────────
runMigrations();

// Clean stale temp upload files on startup
try {
  if (fs.existsSync(TMP_UPLOADS)) {
    const files = fs.readdirSync(TMP_UPLOADS);
    for (const file of files) {
      fs.unlinkSync(path.join(TMP_UPLOADS, file));
    }
    if (files.length > 0) {
      console.log(`[startup] cleaned ${files.length} stale temp upload file(s)`);
    }
  }
} catch {
  // non-fatal
}

// ── Express App ────────────────────────────────────────────────
const app = express();

// CORS — restrict in production
if (ALLOWED_ORIGIN === "*") {
  app.use(cors());
} else {
  app.use(cors({ origin: ALLOWED_ORIGIN }));
}

app.use(express.json({ limit: "2mb" }));
app.use(globalLimiter);
app.use(requestLogger);

// ── Routes ─────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/settings", settingsRoutes);
app.use("/api/backend", apiRoutes);

// ── Static Frontend (SPA) ──────────────────────────────────────
if (HAS_FRONTEND_DIST) {
  app.use(express.static(FRONTEND_DIST));

  // SPA fallback: only serve index.html for routes that are NOT API endpoints
  // and NOT actual static files
  app.get("*", (req, res, next) => {
    // Skip API and known backend prefixes
    if (
      req.path.startsWith("/api/") ||
      req.path === "/health" ||
      req.path.startsWith("/auth/") ||
      req.path.startsWith("/products/") ||
      req.path.startsWith("/settings")
    ) {
      return next();
    }

    // Check if a static file exists at this path
    const filePath = path.join(FRONTEND_DIST, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return next();
    }

    return res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

// ── Error Handler ──────────────────────────────────────────────
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large. Maximum CSV size is 10MB." });
  }
  if (res.headersSent) {
    return undefined;
  }
  return res.status(500).json({ error: "Internal server error" });
});

// ── Listen ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
