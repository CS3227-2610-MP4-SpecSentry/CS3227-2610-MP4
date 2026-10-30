import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { csrfResponseSchema, sessionResponseSchema, type AccountRole, type SessionResponse } from '@specsentry/shared';
import { ContributorWorkspace } from './features/contributor/ContributorWorkspace';

const workspaces: Record<AccountRole, { path: string; label: string }> = {
  CONTRIBUTOR: { path: '/contributor', label: 'Contributor' },
  REVIEWER: { path: '/reviewer', label: 'Reviewer' },
  RELEASE_MAINTAINER: { path: '/releases', label: 'Release Maintainer' },
};

function Login({ onLogin }: { onLogin: (session: SessionResponse) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true);
    setError('');
    try {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
      if (!csrfResponse.ok) throw new Error();
      const { csrfToken } = csrfResponseSchema.parse(await csrfResponse.json());
      const response = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ username: values.get('username'), password: values.get('password') }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? 'Too many sign-in attempts. Try again in 15 minutes.' : 'Unable to sign in. Check your credentials and try again.');
        return;
      }
      const session = sessionResponseSchema.parse(await response.json());
      form.reset();
      onLogin(session);
    } catch { setError('Sign-in is unavailable. Please try again.'); }
    finally { setPending(false); }
  }
  return <>
    <h2>Sign in</h2>
    <p>Use the account provided by your administrator.</p>
    <form onSubmit={(event) => void submit(event)}>
      <label htmlFor="username">Username</label>
      <input id="username" name="username" autoComplete="username" maxLength={80} required disabled={pending} />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" maxLength={256} required disabled={pending} />
      <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </>;
}

export function App() {
  const [session, setSession] = useState<(SessionResponse & { authGeneration: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const generation = useRef(0);
  const adoptedSession = useRef<SessionResponse | null>(null);
  const authGeneration = session?.authGeneration;
  const sessionLost = useCallback(() => {
    if (authGeneration === undefined || generation.current !== authGeneration) return;
    generation.current++; adoptedSession.current = null; setSession(null); setNotice('Your session expired. Please sign in again.');
  }, [authGeneration]);
  const checkSession = useCallback(async (signal?: AbortSignal) => {
    const currentGeneration = generation.current;
    if (signal?.aborted) return;
    try {
      const response = await fetch('/api/auth/session', { signal, credentials: 'same-origin' });
      if (signal?.aborted || generation.current !== currentGeneration) return;
      if (response.status === 401) { generation.current++; adoptedSession.current = null; setSession(null); return; }
      if (!response.ok) throw new Error();
      const current = sessionResponseSchema.parse(await response.json());
      if (!signal?.aborted && generation.current === currentGeneration) {
        const previous = adoptedSession.current;
        if (previous && (previous.account.id !== current.account.id || previous.account.role !== current.account.role || previous.csrfToken !== current.csrfToken)) {
          generation.current++; setLoggingOut(false);
        }
        adoptedSession.current = current;
        setSession({ ...current, authGeneration: generation.current });
      }
    } catch {
      if (!signal?.aborted && generation.current === currentGeneration) { generation.current++; adoptedSession.current = null; setSession(null); setNotice('Unable to verify your session. Please sign in again.'); }
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => checkSession(controller.signal));
    return () => controller.abort();
  }, [checkSession]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => { generation.current++; adoptedSession.current = null; setSession(null); setNotice('Your session expired. Please sign in again.'); }, Math.max(0, session.expiresAt - Date.now()));
    const onFocus = () => { void checkSession(); };
    window.addEventListener('focus', onFocus);
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', onFocus); };
  }, [session, checkSession]);

  async function logout() {
    if (!session) return;
    const logoutGeneration = ++generation.current;
    setSession({ ...session, authGeneration: logoutGeneration });
    setLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'x-csrf-token': session.csrfToken } });
      if (generation.current !== logoutGeneration) return;
      if (!response.ok && response.status !== 401) throw new Error();
      generation.current++; setLoggingOut(false);
      adoptedSession.current = null; setSession(null);
      setNotice('You have signed out.');
    } catch { if (generation.current === logoutGeneration) setNotice('Unable to sign out. Please try again.'); }
    finally { if (generation.current === logoutGeneration) setLoggingOut(false); }
  }

  const workspace = session ? workspaces[session.account.role] : null;
  return <main id="main-content">
    <p className="eyebrow">Specification and review workspace</p>
    <h1>SpecSentry</h1>
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Checking session…</p> : !session || !workspace ?
      <Login onLogin={(current) => { generation.current++; adoptedSession.current = current; setSession({ ...current, authGeneration: generation.current }); setLoggingOut(false); setNotice(''); }} /> : <>
        <nav aria-label="Account"><Link to={workspace.path}>{workspace.label} workspace</Link><button onClick={() => void logout()} disabled={loggingOut}>Sign out</button></nav>
        <p>Signed in as {session.account.username}</p>
        <Routes>
          <Route path="/" element={<Navigate to={workspace.path} replace />} />
          <Route path="/login" element={<Navigate to={workspace.path} replace />} />
          <Route path="/contributor/*" element={session.account.role === 'CONTRIBUTOR'
            ? <ContributorWorkspace key={`${session.account.id}:${session.csrfToken}`} session={session} onSessionLost={sessionLost} />
            : <><h2>Access denied</h2><p>This workspace requires a different account role.</p></>} />
          {Object.entries(workspaces).filter(([role]) => role !== 'CONTRIBUTOR').map(([role, item]) => <Route key={role} path={item.path} element={role === session.account.role ? <>
            <h2>{item.label} workspace</h2><p className="notice">Your account is ready. Workflow features will appear here as they become available.</p>
          </> : <><h2>Access denied</h2><p>This workspace requires a different account role.</p></>} />)}
          <Route path="*" element={<><h2>Page not found</h2><Link to={workspace.path}>Return to your workspace</Link></>} />
        </Routes>
      </>}
  </main>;
}
