import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, type MutableRefObject } from 'react';

type Guard = { message: string };
export const NavigationGuardContext = createContext<MutableRefObject<Guard | null> | null>(null);

export function useNavigationGuard(message: string) {
  const registrationRef = useContext(NavigationGuardContext);
  const owned = useRef<Guard | null>(null);
  useLayoutEffect(() => {
    if (!registrationRef) return;
    const guard = { message };
    registrationRef.current = guard;
    owned.current = guard;
    return () => {
      if (registrationRef.current === guard) registrationRef.current = null;
      if (owned.current === guard) owned.current = null;
    };
  }, [message, registrationRef]);
  useEffect(() => {
    if (!message) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [message]);
  const release = useCallback(() => { if (registrationRef && owned.current && registrationRef.current === owned.current) registrationRef.current = null; }, [registrationRef]);
  return { managed: registrationRef !== null, release, confirmDiscard: () => !message || window.confirm(message) };
}
