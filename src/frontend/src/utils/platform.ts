import { Capacitor } from "@capacitor/core";

/**
 * Returns true when the app is running inside a Capacitor native shell
 * (Android / iOS), false when running in a regular browser.
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Returns the current platform: "android", "ios", or "web".
 */
export function getPlatform(): "android" | "ios" | "web" {
  return Capacitor.getPlatform() as "android" | "ios" | "web";
}
