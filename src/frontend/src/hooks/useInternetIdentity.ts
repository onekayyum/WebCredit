import {
  type PropsWithChildren,
  type ReactNode,
  createContext,
  useContext,
  useMemo,
} from "react";

export type Status = "initializing" | "idle" | "logging-in" | "success" | "loginError";

export type InternetIdentityContext = {
  identity?: undefined;
  login: () => void;
  clear: () => void;
  loginStatus: Status;
  isInitializing: boolean;
  isLoginIdle: boolean;
  isLoggingIn: boolean;
  isLoginSuccess: boolean;
  isLoginError: boolean;
  loginError?: Error;
};

type ProviderValue = InternetIdentityContext;
const InternetIdentityReactContext = createContext<ProviderValue | undefined>(undefined);

function assertProviderPresent(
  context: ProviderValue | undefined,
): asserts context is ProviderValue {
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
}: PropsWithChildren<{
  children: ReactNode;
  createOptions?: unknown;
}>) {
  const value = useMemo<InternetIdentityContext>(
    () => ({
      identity: undefined,
      login: () => {},
      clear: () => {},
      loginStatus: "idle",
      isInitializing: false,
      isLoginIdle: true,
      isLoggingIn: false,
      isLoginSuccess: false,
      isLoginError: false,
      loginError: undefined,
    }),
    [],
  );

  return (
    <InternetIdentityReactContext.Provider value={value}>
      {children}
    </InternetIdentityReactContext.Provider>
  );
}
