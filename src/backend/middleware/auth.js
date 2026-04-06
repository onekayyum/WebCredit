import jwt from "jsonwebtoken";
import db from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-change-me";
const NODE_ENV = String(process.env.NODE_ENV || "development").trim();
const isLocalDev = NODE_ENV === "development" || NODE_ENV === "test";

if (JWT_SECRET === "dev-change-me" && !isLocalDev) {
  console.error("FATAL: Set a strong JWT_SECRET outside local development/test.");
  process.exit(1);
}

function createToken(user) {
  return jwt.sign({ sub: String(user.id), username: user.username }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

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

export { JWT_SECRET, createToken, authMiddleware };
