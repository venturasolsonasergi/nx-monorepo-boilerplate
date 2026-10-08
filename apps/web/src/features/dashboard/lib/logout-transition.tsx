import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface LogoutTransition {
  loggingOut: boolean;
  setLoggingOut: (value: boolean) => void;
}

const LogoutTransitionContext = createContext<LogoutTransition>({
  loggingOut: false,
  setLoggingOut: () => {},
});

// Marks an in-progress logout so the dashboard gating does not race the
// `continue to /` navigation by redirecting to `/login` first.
export function LogoutTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [loggingOut, setLoggingOut] = useState(false);
  const value = useMemo(() => ({ loggingOut, setLoggingOut }), [loggingOut]);

  return (
    <LogoutTransitionContext.Provider value={value}>
      {children}
    </LogoutTransitionContext.Provider>
  );
}

export function useLogoutTransition(): LogoutTransition {
  return useContext(LogoutTransitionContext);
}
