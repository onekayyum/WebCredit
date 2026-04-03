import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { backendInterface } from "../backendTypes";
import { createActorWithConfig } from "../config";

const ACTOR_QUERY_KEY = "actor";

export function useActor() {
  const queryClient = useQueryClient();
  const actorQuery = useQuery<backendInterface>({
    queryKey: [ACTOR_QUERY_KEY],
    queryFn: async () => createActorWithConfig(),
    staleTime: Number.POSITIVE_INFINITY,
    enabled: true,
  });

  useEffect(() => {
    if (actorQuery.data) {
      queryClient.invalidateQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
      queryClient.refetchQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
    }
  }, [actorQuery.data, queryClient]);

  return {
    actor: actorQuery.data || null,
    isFetching: actorQuery.isFetching,
  };
}
