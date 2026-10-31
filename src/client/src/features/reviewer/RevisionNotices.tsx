import { useEffect, useRef, useState } from 'react';
import { notificationsResponseSchema, acknowledgeNotificationResponseSchema, type NotificationItem, type SessionResponse } from '@specsentry/shared';
import type { AuthorizationGeneration } from '../../shared/authorization';

export function RevisionNotices({ session, authorization, refresh, selected, onOpen, onWithdrawn, onAccessLost, onUnauthorized }: {
  session: SessionResponse; authorization: AuthorizationGeneration; refresh: number; selected: string | null;
  onOpen: (proposalId: string, revisionId: string) => void; onWithdrawn: () => void; onAccessLost: () => void; onUnauthorized: () => void;
}) {
  const [page, setPage] = useState<{ items: NotificationItem[]; nextCursor: string | null } | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const generation = useRef(0);
  const selectedRef = useRef(selected);
  const callbacks = useRef({ onWithdrawn, onAccessLost, onUnauthorized });
  useEffect(() => { selectedRef.current = selected; callbacks.current = { onWithdrawn, onAccessLost, onUnauthorized }; }, [selected, onWithdrawn, onAccessLost, onUnauthorized]);
  function invalidatePending() { generation.current++; }
  async function load(cursor?: string) {
    const local = ++generation.current; const auth = authorization.current();
    const current = () => local === generation.current && auth === authorization.current();
    setPending(true); setError('');
    try {
      const response = await fetch(`/api/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { credentials: 'same-origin', cache: 'no-store' });
      if (!current()) return;
      if ([401, 403].includes(response.status)) { setPage(null); callbacks.current.onAccessLost(); if (response.status === 401) callbacks.current.onUnauthorized(); return; }
      if (!response.ok) throw new Error();
      const result = notificationsResponseSchema.parse(await response.json());
      if (!current()) return;
      setPage(result);
      if (result.items.some(item => item.kind === 'WITHDRAWN' && item.proposalId === selectedRef.current)) callbacks.current.onWithdrawn();
    } catch { if (current()) setError('Unable to load revision notices. Refresh notices to retry.'); }
    finally { if (local === generation.current) setPending(false); }
  }
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; invalidatePending(); };
  }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps
  async function acknowledge(item: NotificationItem) {
    if (pending || item.kind !== 'WITHDRAWN') return;
    const local = ++generation.current; const auth = authorization.current(); setPending(true); setError('');
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(item.id)}/acknowledge`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken }, body: JSON.stringify({ kind: 'WITHDRAWN' }) });
      if (local !== generation.current || auth !== authorization.current()) return;
      if ([401, 403].includes(response.status)) { setPage(null); callbacks.current.onAccessLost(); if (response.status === 401) callbacks.current.onUnauthorized(); return; }
      if (!response.ok) throw new Error();
      const result = acknowledgeNotificationResponseSchema.parse(await response.json());
      if (local !== generation.current || auth !== authorization.current()) return;
      setPage(value => value && ({ ...value, items: value.items.map(notice => notice.id === item.id ? { ...notice, readAt: result.readAt } : notice) }));
    } catch { if (local === generation.current && auth === authorization.current()) setError('Unable to acknowledge withdrawal. Refresh notices to reconcile.'); }
    finally { if (local === generation.current) setPending(false); }
  }
  return <section aria-label="Revision notices"><h3>Revision notices</h3>
    <button disabled={pending} onClick={() => void load()}>Refresh notices</button>
    {error && <p role="alert">{error}</p>}
    {page?.items.length === 0 && <p>No revision notices.</p>}
    <ul>{page?.items.map(item => <li key={item.id}>
      {item.kind === 'NEW_REVISION' ? <><span>New revision · {item.readAt ? 'Read' : 'Unread'} · Proposal {item.proposalId} · Revision {item.revisionId}</span> <button onClick={() => onOpen(item.proposalId, item.revisionId)}>Open notified revision {item.revisionId}</button></> : <><span>Proposal {item.proposalId} withdrawn · {item.readAt ? 'Read' : 'Unread'}</span>{!item.readAt && <button disabled={pending} onClick={() => void acknowledge(item)}>Acknowledge withdrawal</button>}</>}
      <p>{new Date(item.createdAt).toLocaleString()}</p>
    </li>)}</ul>
    {page?.nextCursor && <button disabled={pending} onClick={() => void load(page.nextCursor!)}>Next notices page</button>}
  </section>;
}
