import { createActor, type CreateActorOptions, type backendInterface } from "./backend";

interface Config {
  backend_url: string;
}

let configCache: Config | null = null;

export async function loadConfig(): Promise<Config> {
  if (configCache) return configCache;

  const envBaseUrl = process.env.BASE_URL || "/";
  const baseUrl = envBaseUrl.endsWith("/") ? envBaseUrl : `${envBaseUrl}/`;

  try {
    const response = await fetch(`${baseUrl}env.json`);
    const json = (await response.json()) as { backend_url?: string };
    configCache = {
      backend_url: json.backend_url || import.meta.env.VITE_BACKEND_URL || "http://localhost:3001",
    };
    return configCache;
  } catch {
    configCache = {
      backend_url: import.meta.env.VITE_BACKEND_URL || "http://localhost:3001",
    };
    return configCache;
  }
}

export async function createActorWithConfig(
  options?: CreateActorOptions,
): Promise<backendInterface> {
  const config = await loadConfig();
  return createActor("local-backend", null, null, {
    ...options,
    baseUrl: options?.baseUrl ?? config.backend_url,
  });
}
