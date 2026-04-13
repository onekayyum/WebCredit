import { isNativePlatform } from "./utils/platform";

/**
 * Centralized API configuration.
 *
 * Resolution order:
 *  1. VITE_API_URL  env var  (e.g. "http://128.85.36.93:4000")
 *  2. "http://localhost:4000" (safe fallback for local/runtime defaults)
 *
 * For mobile (Capacitor) builds the env var MUST be set to an absolute URL
 * because the WebView has no "same origin" server.
 */
function resolveApiBase(): string {
  const viteApiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const fromEnv = String(viteApiBase).trim() || "http://localhost:4000";

  if (!import.meta.env.VITE_API_URL && isNativePlatform()) {
    console.warn(
      "[API] VITE_API_URL is not set. Falling back to http://localhost:4000.",
      "Set VITE_API_URL in .env for device/emulator builds.",
    );
  }

  let base = fromEnv;

  // If scheme is missing, assume https for production-style hosts.
  // (Local hosts/IPs should still be configured explicitly with http://)
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }

  // Remove trailing slash for consistent URL joining
  base = base.replace(/\/+$/, "");

  // Defensive normalization: if env mistakenly includes `/auth`,
  // keep API root at host level so `/auth/login` is not duplicated.
  if (base.endsWith("/auth")) {
    base = base.slice(0, -"/auth".length);
  }

  if (base) {
    console.log("[API] Using API base:", base);
  }

  return base;
}

export const API_BASE: string = resolveApiBase();
console.log("API_BASE:", API_BASE);

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE) {
    return normalizedPath;
  }
  return new URL(normalizedPath, `${API_BASE}/`).toString();
}
