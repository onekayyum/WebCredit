type CapacitorLike = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function getCapacitor(): CapacitorLike | null {
  if (typeof globalThis === "undefined") return null;
  const value = (globalThis as { Capacitor?: CapacitorLike }).Capacitor;
  return value && typeof value === "object" ? value : null;
}

/**
 * Returns true when the app is running inside a Capacitor native shell
 * (Android / iOS), false when running in a regular browser.
 */
export function isNativePlatform(): boolean {
  const capacitor = getCapacitor();
  return Boolean(capacitor?.isNativePlatform?.());
}

/**
 * Returns the current platform: "android", "ios", or "web".
 */
export function getPlatform(): "android" | "ios" | "web" {
  const platform = getCapacitor()?.getPlatform?.();
  if (platform === "android" || platform === "ios") {
    return platform;
  }
  return "web";
}
