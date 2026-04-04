import type { backendInterface } from "./backendTypes";
import { createRestBackend } from "./restBackend";

export function createActorWithConfig(): backendInterface {
  return createRestBackend();
}
