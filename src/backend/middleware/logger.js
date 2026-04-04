/**
 * Simple request logger middleware.
 * Logs method, URL, status code, and response time.
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function (...args) {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;

    // Skip logging static asset requests to reduce noise
    if (
      url.startsWith("/assets/") ||
      url.endsWith(".js") ||
      url.endsWith(".css") ||
      url.endsWith(".png") ||
      url.endsWith(".ico")
    ) {
      return originalEnd.apply(res, args);
    }

    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    const logFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    logFn(`[${new Date().toISOString()}] ${method} ${url} ${status} ${duration}ms`);

    return originalEnd.apply(res, args);
  };

  next();
}

export { requestLogger };
