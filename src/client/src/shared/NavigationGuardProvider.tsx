import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router-dom';
import { NavigationGuardContext } from './navigationGuard';

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const guard = useRef<{ message: string } | null>(null);
  const shouldBlock = useCallback<BlockerFunction>(({ currentLocation, nextLocation }) =>
    !!guard.current?.message && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search), []);
  const blocker = useBlocker(shouldBlock);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const message = guard.current?.message;
    if (!message || window.confirm(message)) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  return <NavigationGuardContext.Provider value={guard}>{children}</NavigationGuardContext.Provider>;
}
