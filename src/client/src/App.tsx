import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { csrfResponseSchema, sessionResponseSchema, type AccountRole, type SessionResponse } from '@specsentry/shared';
import { ReviewerWorkspace } from './features/reviewer/ReviewerWorkspace';
import { ContributorWorkspace } from './features/contributor/ContributorWorkspace';
import { Icon } from './shared/Icon';

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
  return <div className="login-card">
    <div className="login-icon"><Icon name="lock" /></div>
    <h2>Sign in</h2>
    <p>Use the account provided by your administrator.</p>
    <form onSubmit={(event) => void submit(event)}>
      <label htmlFor="username">Username</label>
      <input id="username" name="username" autoComplete="username" maxLength={80} required disabled={pending} />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" maxLength={256} required disabled={pending} />
      <button type="submit" disabled={pending}>{pending ? 'Signing inâ€¦' : 'Sign in'}</button>
      {error && <p role="alert">{error}</p>}
    </form>
    <p className="login-footnote"><Icon name="shield" /> Your workspace starts with a secure sign-in.</p>
  </div>;
}

type NavigationProps = {
  workspace: { path: string; label: string }; username: string; loggingOut: boolean;
  onLogout(): void; onNavigate?(): void;
};

function SidebarContent({ workspace, username, loggingOut, onLogout, onNavigate }: NavigationProps) {
  return <>
    <Link className="brand" to={workspace.path} aria-label="SpecSentry workspace" title="SpecSentry workspace" onClick={onNavigate}><span className="brand-mark"><Icon name="shield" /></span><span className="sidebar-label">SpecSentry<small>Specification workspace</small></span></Link>
    <div className="sidebar-scroll">
      <p className="nav-caption sidebar-label">WORKSPACE</p>
      <nav aria-label="Account"><Link className="nav-link active" aria-current="page" aria-label={`${workspace.label} workspace`} title={`${workspace.label} workspace`} to={workspace.path} onClick={onNavigate}><Icon name="grid" /><span className="sidebar-label">{workspace.label} workspace</span></Link></nav>
    </div>
    <footer className="sidebar-footer">
      <div className="sidebar-note"><Icon name="lock" /><p className="sidebar-label">Thoughtful specifications.<br />Confident reviews.</p></div>
      <div className="sidebar-account" title={`${username} - ${workspace.label}`}><span className="avatar" aria-hidden="true">{username.slice(0, 1).toUpperCase()}</span><div className="sidebar-label"><strong>{username}</strong><small>{workspace.label}</small></div></div>
      <button className="signout-button" aria-label="Sign out" title="Sign out" onClick={onLogout} disabled={loggingOut}><Icon name="logout" /><span className="sidebar-label">Sign out</span></button>
    </footer>
  </>;
}

function MobileNavigation(props: NavigationProps) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    const target = window.matchMedia?.('(min-width: 768px)').matches
      ? document.querySelector<HTMLButtonElement>('.desktop-navigation-toggle') : trigger.current;
    target?.focus();
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (open) element?.showModal();
    else if (element?.open) element.close();
  }, [open]);
  useEffect(() => {
    const desktop = window.matchMedia?.('(min-width: 768px)');
    const onResize = () => { if (desktop?.matches) close(); };
    desktop?.addEventListener('change', onResize);
    return () => desktop?.removeEventListener('change', onResize);
  }, [close]);
  return <>
    <button className="icon-button mobile-navigation-toggle" ref={trigger} aria-label="Open navigation" aria-haspopup="dialog" aria-controls="mobile-navigation" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" /></button>
    <dialog id="mobile-navigation" className="navigation-drawer" aria-label="Workspace navigation" ref={dialog} onCancel={event => { event.preventDefault(); close(); }} onClose={close} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="sidebar">
        <button className="drawer-close" autoFocus aria-label="Close navigation" onClick={close}><Icon name="close" /></button>
        <SidebarContent {...props} onNavigate={close} />
      </div>
    </dialog>
  </>;
}

export function App() {
  const location = useLocation();
  const [session, setSession] = useState<(SessionResponse & { authGeneration: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(true);
  const generation = useRef(0);
  const [authorization] = useState(() => ({ current: () => generation.current, invalidate: () => { generation.current++; } }));
  const adoptedSession = useRef<SessionResponse | null>(null);
  const invalidate = useCallback((message: string) => { generation.current++; adoptedSession.current = null; setSession(null); setNotice(message); setLoading(false); }, []);
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
      if (response.status === 401) { invalidate('Your session ended. Please sign in again.'); return; }
      if (!response.ok) throw new Error();
      const current = sessionResponseSchema.parse(await response.json());
      if (!signal?.aborted && generation.current === currentGeneration) {
        const previous = adoptedSession.current;
        if (previous && (JSON.stringify(previous.account) !== JSON.stringify(current.account) || previous.csrfToken !== current.csrfToken)) {
          generation.current++; setLoggingOut(false);
        }
        adoptedSession.current = current;
        setSession({ ...current, authGeneration: generation.current });
      }
    } catch {
      if (!signal?.aborted && generation.current === currentGeneration) { generation.current++; adoptedSession.current = null; setSession(null); setNotice('Unable to verify your session. Please sign in again.'); }
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [invalidate]);
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
    // Reviewer requests must lose protected content immediately; Contributor input
    // remains recoverable if logout fails, with callbacks bound to this generation.
    if (session.account.role === 'REVIEWER') { adoptedSession.current = null; setSession(null); }
    else setSession({ ...session, authGeneration: logoutGeneration });
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
  const path = location.pathname.replace(/\/+$/, '');
  const taskTitle = session?.account.role === 'CONTRIBUTOR' && path.startsWith('/contributor')
    ? path.endsWith('/edit') ? 'Edit draft' : path === '/contributor/new' ? 'Create draft' : path.includes('/drafts/') ? 'Draft details' : 'Private drafts'
    : workspace ? `${workspace.label} workspace` : 'SpecSentry';
  return <div className={session && workspace ? `app-shell${navigationOpen ? '' : ' navigation-collapsed'}` : 'login-shell'}>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to main content</a>
    {session && workspace && <aside className="sidebar desktop-sidebar" id="workspace-navigation">
      <SidebarContent workspace={workspace} username={session.account.username} loggingOut={loggingOut} onLogout={() => void logout()} />
    </aside>}
    <div className="app-body">
      {session && workspace ? <header className="topbar">
        <div className="topbar-start"><button className="icon-button desktop-navigation-toggle" aria-label={navigationOpen ? 'Collapse navigation' : 'Expand navigation'} aria-controls="workspace-navigation" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(open => !open)}><Icon name="menu" /></button><MobileNavigation workspace={workspace} username={session.account.username} loggingOut={loggingOut} onLogout={() => void logout()} />{session.account.role === 'REVIEWER' && path === workspace.path ? <h1 className="topbar-task">{workspace.label}</h1> : <span className="topbar-task" title={taskTitle}>{taskTitle}</span>}</div>
        <span className="account-label" title={`Signed in as ${session.account.username}`}>Signed in as {session.account.username}</span>
      </header> : <header className="login-brand"><span className="brand-mark"><Icon name="shield" /></span><h1>SpecSentry</h1><p>Bring clarity to every change.</p></header>}
      <main id="main-content" tabIndex={-1}>
        {notice && <p className="notice" role="status">{notice}</p>}
        {loading ? <div className="loading-panel"><span className="loading-dot" aria-hidden="true" /><p role="status">Checking session...</p></div> : !session || !workspace ?
          <Login onLogin={(current) => { generation.current++; adoptedSession.current = current; setSession({ ...current, authGeneration: generation.current }); setLoggingOut(false); setNotice(''); }} /> : <>
        <Routes>
          <Route path="/" element={<Navigate to={workspace.path} replace />} />
          <Route path="/login" element={<Navigate to={workspace.path} replace />} />
          <Route path="/contributor/*" element={session.account.role === 'CONTRIBUTOR'
            ? <ContributorWorkspace key={`${session.account.id}:${session.csrfToken}`} session={session} onSessionLost={sessionLost} />
            : <section className="workspace-placeholder"><h1>Access denied</h1><p>This workspace requires a different account role.</p></section>} />
          {Object.entries(workspaces).filter(([role]) => role !== 'CONTRIBUTOR').map(([role, item]) => <Route key={role} path={item.path} element={role === session.account.role ? role === 'REVIEWER' ? <ReviewerWorkspace key={`${JSON.stringify(session.account)}:${session.csrfToken}`} session={session} authorization={authorization} onUnauthorized={() => invalidate('Your session ended. Please sign in again.')} /> : <section className="workspace-placeholder">
            <h1>{item.label} workspace</h1><p className="notice">Your account is ready. Workflow features will appear here as they become available.</p>
          </section> : <section className="workspace-placeholder"><h1>Access denied</h1><p>This workspace requires a different account role.</p></section>} />)}
          <Route path="*" element={<section className="workspace-placeholder"><h1>Page not found</h1><Link to={workspace.path}>Return to your workspace</Link></section>} />
        </Routes>
      </>}
      </main>
    </div>
  </div>;
}
