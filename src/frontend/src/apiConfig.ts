import { isNativePlatform } from "./utils/platform";

/**
 * Centralized API configuration.
 *
 * Resolution order:
 *  1. VITE_API_URL  env var  (e.g. "http://128.85.36.93:4000")
 *  2. VITE_BACKEND_BASE_URL (legacy compatibility)
 *  3. "" (same-origin)
 *
 * For mobile (Capacitor) builds the env var MUST be set to an absolute URL
 * because the WebView has no "same origin" server.
 */
function resolveApiBase(): string {
  const rawValue =
    import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_BASE_URL || "";
  const fromEnv = String(rawValue).trim();

  if (!import.meta.env.VITE_API_URL && isNativePlatform()) {
    console.error(
      "[API] VITE_API_URL is not set for native build.",
      "Native mobile builds require an absolute VITE_API_URL (http/https).",
    );
  }

  if (!fromEnv) {
    return "";
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
