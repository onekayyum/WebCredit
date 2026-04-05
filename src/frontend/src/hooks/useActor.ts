import { useMemo } from "react";
import type { backendInterface } from "../backendTypes";
import { createActorWithConfig } from "../config";

/**
 * Returns a stable REST-backend actor.
 * The previous implementation wrapped the actor in a react-query cache, then
 * invalidated + refetched *every other query* whenever the actor reference
 * changed. Since the REST backend is stateless (no canister reference to
 * track), a simple useMemo is sufficient and avoids the unnecessary
 * cascade of refetches.
 */
export function useActor() {
  const actor = useMemo<backendInterface>(() => createActorWithConfig(), []);

  return {
    actor,
    isFetching: false,
  };
}
