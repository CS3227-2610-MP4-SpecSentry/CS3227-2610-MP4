import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaintainerAudit } from './MaintainerAudit';

const session = { account: { id: 'maintainer-one', username: 'maintainer', role: 'RELEASE_MAINTAINER' as const },
  csrfToken: 'a'.repeat(64), expiresAt: Date.now() + 100_000 };
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

afterEach(() => vi.unstubAllGlobals());

describe('Maintainer restricted audit', () => {
  it('applies strict filters and renders only the safe projection as text', async () => {
    const item = { id: 'event-one', source: 'AI' as const, actorId: 'reviewer-one',
      proposalId: 'proposal-one', releaseId: null, target: 'proposal-one', action: 'AI_REVIEWER',
      outcome: 'SUCCESS', timestamp: '2026-11-06T00:00:00.000Z',
      summary: '<script>safe metadata only</script>', reason: null,
      aiMetadata: { templateVersion: 'reviewer-risk-v1', contextHash: null,
        errorClass: null, latencyMs: 25, attemptCount: 1 } };
    const fetch = vi.fn().mockResolvedValueOnce(reply({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(reply({ items: [item], nextCursor: null }));
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter><MaintainerAudit session={session} onSessionLost={vi.fn()} /></MemoryRouter>);
    expect(await screen.findByText('No audit events match these filters.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Actor ID'), { target: { value: 'reviewer-one' } });
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'AI_REVIEWER' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply audit filters' }));
    expect(await screen.findByText('<script>safe metadata only</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(String(fetch.mock.calls[1]?.[0])).toContain('actorId=reviewer-one');
    expect(String(fetch.mock.calls[1]?.[0])).toContain('action=AI_REVIEWER');
    expect(screen.getByText(/AI template reviewer-risk-v1/)).toBeInTheDocument();
  });

  it('clears protected results and reports session loss on 401', async () => {
    const onSessionLost = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({}, 401)));
    render(<MemoryRouter><MaintainerAudit session={session} onSessionLost={onSessionLost} /></MemoryRouter>);
    await waitFor(() => expect(onSessionLost).toHaveBeenCalledOnce());
    expect(screen.queryByText('<script>safe metadata only</script>')).not.toBeInTheDocument();
  });
});
