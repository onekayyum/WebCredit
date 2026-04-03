import type { backendInterface } from "./backend";
import { createRestBackend } from "./restBackend";

export async function createActorWithConfig(): Promise<backendInterface> {
  return createRestBackend();
}
