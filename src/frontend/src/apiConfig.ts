import { isNativePlatform } from "./utils/platform";

/**
 * Centralized API configuration.
 *
 * Resolution order:
 *  1. VITE_API_URL  env var  (e.g. "http://128.85.36.93:4000")
 *  2. VITE_BACKEND_BASE_URL  (legacy compat)
 *  3. ""  (same-origin — only valid for web builds served by the backend)
 *
 * For mobile (Capacitor) builds the env var MUST be set to an absolute URL
 * because the WebView has no "same origin" server.
 */
function resolveApiBase(): string {
  const fromEnv =
    import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_BASE_URL || "";

  if (!fromEnv && isNativePlatform()) {
    console.warn(
      "[API] VITE_API_URL is not set. Mobile builds require an absolute URL.",
      "API calls will fail until VITE_API_URL is configured in .env",
    );
  }

  // Remove trailing slash for consistent URL joining
  const base = fromEnv.replace(/\/+$/, "");

  if (base) {
    console.log("[API] Using API base:", base);
  }

  return base;
}

export const API_BASE: string = resolveApiBase();
