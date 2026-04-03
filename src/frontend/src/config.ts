import type { backendInterface } from "./backendTypes";
import { createRestBackend } from "./restBackend";

export async function createActorWithConfig(): Promise<backendInterface> {
  return createRestBackend();
}
