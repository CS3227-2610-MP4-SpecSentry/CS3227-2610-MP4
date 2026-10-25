import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

afterEach(() => vi.unstubAllGlobals());

describe('service status', () => {
  it('validates the API response before announcing service availability', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', service: 'specsentry' }) }));
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(await screen.findByText('Service is online.')).toBeInTheDocument();
  });
  it.each([null, { status: 'ok', service: 'other' }])('handles malformed API output safely: %s', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(await screen.findByText(/Service is unavailable/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'SpecSentry' })).toBeInTheDocument();
  });
  it('handles network failure without exposing raw errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('internal-secret')));
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(await screen.findByText(/Service is unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/internal-secret/)).not.toBeInTheDocument();
  });
});
