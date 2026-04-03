import {
  type PropsWithChildren,
  type ReactNode,
  createContext,
  useContext,
  useMemo,
} from "react";

export type Status = "idle";

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
