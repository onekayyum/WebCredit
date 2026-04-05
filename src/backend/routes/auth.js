import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "../db.js";
import { createToken } from "../middleware/auth.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";
import { validateSignupPayload, nowNs } from "../utils/helpers.js";

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const router = Router();

router.post("/signup", authRateLimiter, async (req, res) => {
  const validation = validateSignupPayload(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(validation.username);
  if (existing) {
    return res.status(409).json({ error: "username already exists" });
  }
  const userCount = Number(db.prepare("SELECT COUNT(*) AS count FROM users").get().count);

  const createdAt = nowNs();
  const hashed = await bcrypt.hash(validation.password, BCRYPT_ROUNDS);
  const info = db.prepare("INSERT INTO users (username, password, createdAt) VALUES (?, ?, ?)").run(
    validation.username,
    hashed,
    createdAt,
  );
  const id = Number(info.lastInsertRowid);

  if (userCount === 0) {
    db.prepare("UPDATE customers SET user_id = ? WHERE user_id IS NULL").run(id);
    db.prepare("UPDATE products SET user_id = ? WHERE user_id IS NULL").run(id);
    db.prepare("UPDATE transactions SET user_id = ? WHERE user_id IS NULL").run(id);
  }

  // Create default settings for the new user
  db.prepare(
    "INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)",
  ).run(id);

  const token = createToken({ id, username: validation.username });
  return res.status(201).json({ token, user: { id: String(id), username: validation.username } });
});

router.post("/login", authRateLimiter, async (req, res) => {
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

export default router;
