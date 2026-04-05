/**
 * Centralized API configuration.
 *
 * Resolution order:
 *  1. VITE_API_URL  env var  (e.g. "http://128.85.36.93:4000")
 *  2. VITE_BACKEND_BASE_URL  (legacy compat)
 *  3. ""  (same-origin, works for web builds served by the backend)
 *
 * For mobile (Capacitor) builds the env var MUST be set to an absolute URL
 * because the WebView has no "same origin" server.
 */
export const API_BASE: string =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_BASE_URL || "";
