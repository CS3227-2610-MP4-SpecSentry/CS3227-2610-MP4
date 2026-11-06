import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { acknowledgeNotificationResponseSchema, notificationsResponseSchema,
  type ReleaseCandidateDetailResponse, type SessionResponse } from '@specsentry/shared';

type Props = { session: SessionResponse; onSessionLost(): void };
type Notice = ReleaseCandidateDetailResponse['unreadRevocationNotices'][number];

export function MaintainerNotifications({ onSessionLost }: Props) {
  const [page, setPage] = useState<ReturnType<typeof notificationsResponseSchema.parse> | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError('');
      const query = new URLSearchParams({ limit: '20' });
      if (cursor) query.set('cursor', cursor);
      try {
        const response = await fetch(`/api/notifications?${query}`, {
          credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        });
        if (response.status === 401) { setPage(null); onSessionLost(); return; }
        if (response.status === 403) { setPage(null); onSessionLost(); return; }
        if (!response.ok) throw new Error();
        const result = notificationsResponseSchema.parse(await response.json());
        if (!controller.signal.aborted) setPage(result);
      } catch {
        if (!controller.signal.aborted) setError('Unable to load Maintainer notifications. Try again.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [attempt, cursor, onSessionLost]);

  return <section className="draft-panel" aria-labelledby="maintainer-notifications-title">
    <div className="panel-heading"><div><h2 id="maintainer-notifications-title">Release notifications</h2>
      <p>Approval revocations remain release blockers until the proposal is removed.</p></div></div>
    {loading ? <p role="status">Loading release notifications...</p>
      : error ? <><p role="alert">{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Retry notifications</button></>
        : page?.items.length === 0 ? <p>No release notifications.</p>
          : <ul>{page?.items.map(notice => <li key={notice.id}>
            {notice.kind === 'APPROVAL_REVOKED' ? <>
              <strong>Approval revoked</strong> for proposal {notice.proposalId} by Reviewer {notice.reviewerId}.
              <p>{notice.reason}</p><p>{notice.readAt ? 'Read' : 'Unread'} · {new Date(notice.createdAt).toLocaleString()}</p>
              <Link to={`/releases/${encodeURIComponent(notice.candidateId)}`}>Open affected candidate</Link>
            </> : <><strong>{notice.kind}</strong> for proposal {notice.proposalId}.</>}
          </li>)}</ul>}
    {(cursor || page?.nextCursor) && <div className="pagination">
      {cursor && <button type="button" disabled={loading} onClick={() => setCursor(null)}>First notification page</button>}
      {page?.nextCursor && <button type="button" disabled={loading} onClick={() => setCursor(page.nextCursor)}>Next notification page</button>}
    </div>}
  </section>;
}

export function RenderedRevocationAcknowledgements({ candidateId, notices, session, onSessionLost }:
  { candidateId: string; notices: readonly Notice[]; session: SessionResponse; onSessionLost(): void }) {
  const attempted = useRef(new Set<string>());
  const [failed, setFailed] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(0);

  useEffect(() => {
    let active = true;
    const controllers: AbortController[] = [];
    for (const notice of notices) {
      if (attempted.current.has(notice.id)) continue;
      attempted.current.add(notice.id);
      const controller = new AbortController(); controllers.push(controller);
      void (async () => {
        try {
          const response = await fetch(`/api/notifications/${encodeURIComponent(notice.id)}/acknowledge`, {
            method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrfToken },
            body: JSON.stringify({ kind: 'APPROVAL_REVOKED', candidateId,
              invalidationId: notice.invalidationId }),
          });
          if (response.status === 401) { if (active) onSessionLost(); return; }
          if (response.status === 403) { if (active) onSessionLost(); return; }
          if (!response.ok) throw new Error();
          acknowledgeNotificationResponseSchema.parse(await response.json());
          if (active) setAcknowledged(value => value + 1);
        } catch {
          if (active && !controller.signal.aborted) setFailed(items => [...items, notice.id]);
        }
      })();
    }
    return () => { active = false; controllers.forEach(controller => controller.abort()); };
  }, [candidateId, notices, onSessionLost, session.csrfToken]);

  if (!notices.length) return null;
  return <section aria-labelledby="revocation-notices-title"><h2 id="revocation-notices-title">Unread revocation notices</h2>
    <p>Opening this candidate marks only the notices shown below as read. The approval blocker remains.</p>
    <ul>{notices.map(notice => <li key={notice.id}><strong>Proposal {notice.proposalId}</strong> · Reviewer {notice.reviewerId}
      <p>{notice.reason}</p><p>{new Date(notice.createdAt).toLocaleString()}</p></li>)}</ul>
    {acknowledged > 0 && <p role="status">Marked {acknowledged} displayed notice{acknowledged === 1 ? '' : 's'} as read.</p>}
    {failed.length > 0 && <p role="alert">Could not mark {failed.length} displayed notice{failed.length === 1 ? '' : 's'} as read. The blocker is unchanged.</p>}
  </section>;
}
