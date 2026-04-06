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
import { buildApiUrl } from "../apiConfig";
import {
  AUTH_EVENT,
  clearAuthSession,
  getAuthUser,
  getToken,
  setAuthSession,
} from "../utils/auth";

export type Status = "idle" | "loading" | "success" | "error";

export type AuthContext = {
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

/** @deprecated Use AuthContext instead */
export type InternetIdentityContext = AuthContext;

const AuthReactContext = createContext<AuthContext | undefined>(undefined);

function assertProviderPresent(
  context: AuthContext | undefined,
): asserts context is AuthContext {
  if (!context) {
    throw new Error(
      "AuthProvider is not present. Wrap your component tree with it.",
    );
  }
}

export const useAuth = (): AuthContext => {
  const context = useContext(AuthReactContext);
  assertProviderPresent(context);
  return context;
};

/** @deprecated Use useAuth instead */
export const useInternetIdentity = useAuth;

export function AuthProvider({
  children,
}: PropsWithChildren<{ children: ReactNode }>) {
  const [identity, setIdentity] = useState<AuthContext["identity"]>(
    getAuthUser() ?? undefined,
  );
  const [token, setToken] = useState<string | undefined>(
    getToken() ?? undefined,
  );
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

  const authenticate = useCallback(
    async (
      path: "/auth/login" | "/auth/signup",
      username: string,
      password: string,
    ) => {
      setLoginStatus("loading");
      setLoginError(undefined);
      try {
        const url = buildApiUrl(path);
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim(), password }),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(`[Auth] ${path} failed (${response.status})`, text);
          let message = text || `Request failed: ${response.status}`;
          try {
            const parsed = JSON.parse(text);
            if (parsed?.error) {
              message = String(parsed.error);
            }
          } catch {
            // keep plain-text response
          }
          throw new Error(message);
        }

        const data = await response.json();
        setAuthSession(data.token, data.user);
        setLoginStatus("success");
        return true;
      } catch (error) {
        setLoginStatus("error");
        setLoginError(
          error instanceof Error ? error : new Error(String(error)),
        );
        return false;
      }
    },
    [],
  );

  const login = useCallback(
    (username: string, password: string) =>
      authenticate("/auth/login", username, password),
    [authenticate],
  );
  const signup = useCallback(
    (username: string, password: string) =>
      authenticate("/auth/signup", username, password),
    [authenticate],
  );

  const clear = useCallback(() => {
    clearAuthSession();
    setLoginStatus("idle");
    setLoginError(undefined);
  }, []);

  const value = useMemo<AuthContext>(
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
    <AuthReactContext.Provider value={value}>
      {children}
    </AuthReactContext.Provider>
  );
}

/** @deprecated Use AuthProvider instead */
export const InternetIdentityProvider = AuthProvider;
