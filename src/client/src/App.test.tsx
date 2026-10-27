import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const csrfToken = 'a'.repeat(64);
const session = (role = 'CONTRIBUTOR') => ({ account: { id: 'one', username: 'alice', role }, csrfToken, expiresAt: Date.now() + 1800000 });
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('base authentication', () => {
  it('shows the login form without protected content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({}, 401)));
    render(<MemoryRouter initialEntries={['/reviewer']}><App /></MemoryRouter>);
    expect(await screen.findByLabelText('Username')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reviewer workspace' })).not.toBeInTheDocument();
  });
  it('signs in with CSRF and signs out', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({}, 401)).mockResolvedValueOnce(reply({ csrfToken }))
      .mockResolvedValueOnce(reply(session())).mockResolvedValueOnce(reply({ items: [], nextCursor: null })).mockResolvedValueOnce(reply({}, 204));
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter><App /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'synthetic-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Contributor workspace' })).toBeInTheDocument();
    expect(fetch.mock.calls[2]?.[1]).toMatchObject({ method: 'POST', headers: { 'x-csrf-token': csrfToken } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('You have signed out.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });
  it.each(['CONTRIBUTOR', 'REVIEWER', 'RELEASE_MAINTAINER'])('restores the %s session', async (role) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(session(role))));
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(await screen.findByText('Signed in as alice')).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });
  it('denies another role workspace', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(session())));
    render(<MemoryRouter initialEntries={['/reviewer']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  });
  it('handles failed login without revealing backend details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply({}, 401)).mockResolvedValueOnce(reply({ csrfToken }))
      .mockResolvedValueOnce(reply({ message: 'internal-secret' }, 401)));
    render(<MemoryRouter><App /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to sign in.');
    expect(screen.queryByText(/internal-secret/)).not.toBeInTheDocument();
  });
  it('clears the workspace when the session expires', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ ...session(), expiresAt: Date.now() + 300 })));
    render(<MemoryRouter><App /></MemoryRouter>);
    await screen.findByText('Signed in as alice');
    expect(await screen.findByText('Your session expired. Please sign in again.')).toBeInTheDocument();
    expect(screen.queryByText('Signed in as alice')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });
});
