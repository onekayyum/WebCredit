import {
  type PropsWithChildren,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AUTH_EVENT, clearAuthSession, getAuthUser, getToken, setAuthSession } from "../utils/auth";

const API_BASE = import.meta.env.VITE_BACKEND_BASE_URL || "";

export type Status = "idle" | "loading" | "success" | "error";

export type InternetIdentityContext = {
  identity?: { id: string; username: string };
  login: (username: string, password: string) => Promise<boolean>;
  signup: (username: string, password: string) => Promise<boolean>;
  clear: () => void;
  loginStatus: Status;
  isInitializing: boolean;
  isLoginIdle: boolean;
  isLoggingIn: boolean;
  isLoginSuccess: boolean;
  isLoginError: boolean;
  loginError?: Error;
  token?: string;
};

const InternetIdentityReactContext = createContext<
  InternetIdentityContext | undefined
>(undefined);

function assertProviderPresent(
  context: InternetIdentityContext | undefined,
): asserts context is InternetIdentityContext {
  if (!context) {
    throw new Error(
      "InternetIdentityProvider is not present. Wrap your component tree with it.",
    );
  }
}

export const useInternetIdentity = (): InternetIdentityContext => {
  const context = useContext(InternetIdentityReactContext);
  assertProviderPresent(context);
  return context;
};

export function InternetIdentityProvider({
  children,
}: PropsWithChildren<{ children: ReactNode }>) {
  const [identity, setIdentity] = useState<
    InternetIdentityContext["identity"]
  >(getAuthUser() ?? undefined);
  const [token, setToken] = useState<string | undefined>(getToken() ?? undefined);
  const [loginStatus, setLoginStatus] = useState<Status>("idle");
  const [loginError, setLoginError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    const onAuthChanged = () => {
      setIdentity(getAuthUser() ?? undefined);
      setToken(getToken() ?? undefined);
    };
    window.addEventListener(AUTH_EVENT, onAuthChanged);
    return () => window.removeEventListener(AUTH_EVENT, onAuthChanged);
  }, []);

  const authenticate = useCallback(async (path: "/auth/login" | "/auth/signup", username: string, password: string) => {
    setLoginStatus("loading");
    setLoginError(undefined);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      setAuthSession(data.token, data.user);
      setLoginStatus("success");
      return true;
    } catch (error) {
      setLoginStatus("error");
      setLoginError(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }, []);

  const login = useCallback((username: string, password: string) => authenticate("/auth/login", username, password), [authenticate]);
  const signup = useCallback((username: string, password: string) => authenticate("/auth/signup", username, password), [authenticate]);

  const clear = useCallback(() => {
    clearAuthSession();
    setLoginStatus("idle");
    setLoginError(undefined);
  }, []);

  const value = useMemo<InternetIdentityContext>(
    () => ({
      identity,
      login,
      signup,
      clear,
      loginStatus,
      isInitializing: false,
      isLoginIdle: loginStatus === "idle",
      isLoggingIn: loginStatus === "loading",
      isLoginSuccess: loginStatus === "success",
      isLoginError: loginStatus === "error",
      loginError,
      token,
    }),
    [identity, login, signup, clear, loginStatus, loginError, token],
  );

  return (
    <InternetIdentityReactContext.Provider value={value}>
      {children}
    </InternetIdentityReactContext.Provider>
  );
}
