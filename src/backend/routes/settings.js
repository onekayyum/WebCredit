import { Router } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.get("/", authMiddleware, (req, res) => {
  const userId = req.user.id;
  let settings = db
    .prepare("SELECT * FROM user_settings WHERE user_id = ?")
    .get(userId);

  if (!settings) {
    db.prepare("INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)").run(userId);
    settings = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(userId);
  }

  return res.json({
    language: settings.language,
    currency: settings.currency,
    businessName: settings.businessName,
    threshold: settings.threshold,
    inactiveDays: settings.inactiveDays,
    reminderEnabled: Boolean(settings.reminderEnabled),
  });
});

router.put("/", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const b = req.body ?? {};

  const language = String(b.language ?? "en").trim();
  const currency = String(b.currency ?? "USD").trim();
  const businessName = String(b.businessName ?? "").trim();
  const threshold = Number(b.threshold ?? 1000);
  const inactiveDays = Number(b.inactiveDays ?? 7);
  const reminderEnabled = b.reminderEnabled ? 1 : 0;

  const allowedLangs = ["en", "hi", "ur", "ar"];
  if (!allowedLangs.includes(language)) {
    return res.status(400).json({ error: "Invalid language" });
  }
  if (!Number.isFinite(threshold) || threshold < 0) {
    return res.status(400).json({ error: "Invalid threshold" });
  }
  if (!Number.isFinite(inactiveDays) || inactiveDays < 1) {
    return res.status(400).json({ error: "Invalid inactiveDays" });
  }

  db.prepare(`
    INSERT INTO user_settings (user_id, language, currency, businessName, threshold, inactiveDays, reminderEnabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id)
    DO UPDATE SET language = excluded.language, currency = excluded.currency, businessName = excluded.businessName,
                  threshold = excluded.threshold, inactiveDays = excluded.inactiveDays, reminderEnabled = excluded.reminderEnabled
  `).run(userId, language, currency, businessName, threshold, inactiveDays, reminderEnabled);

  return res.json({ ok: true });
});

export default router;
