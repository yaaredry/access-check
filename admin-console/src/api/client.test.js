import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './client';

// ── helpers ──────────────────────────────────────────────────────────────────

function mockFetch(status, body = {}) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  });
}

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('username', 'admin');
  delete window.location;
  window.location = { replace: vi.fn() };
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 401 / 403 handling ───────────────────────────────────────────────────────

describe('api client — auth error handling', () => {
  it('clears token and redirects to login on 401', async () => {
    mockFetch(401, { error: 'Unauthorized' });
    await api.listPeople();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('username')).toBeNull();
    expect(window.location.replace).toHaveBeenCalledWith('/admin/login');
  });

  it('clears token and redirects to login on 403', async () => {
    mockFetch(403, { error: 'Forbidden' });
    await api.listPeople();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('username')).toBeNull();
    expect(window.location.replace).toHaveBeenCalledWith('/admin/login');
  });

  it('throws an error with the message on other non-ok responses', async () => {
    mockFetch(500, { error: 'Internal server error' });
    await expect(api.listPeople()).rejects.toThrow('Internal server error');
  });

  it('returns data on a successful response', async () => {
    mockFetch(200, { rows: [], total: 0 });
    const result = await api.listPeople();
    expect(result).toEqual({ rows: [], total: 0 });
  });

  it('returns null on 204', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 204, ok: true });
    const result = await api.deletePerson(1);
    expect(result).toBeNull();
  });

  it('includes Authorization header when token is present', async () => {
    mockFetch(200, []);
    await api.listUsers();
    const headers = globalThis.fetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer test-token');
  });

  it('does not include Authorization header when no token', async () => {
    localStorage.removeItem('token');
    mockFetch(200, []);
    await api.listUsers();
    const headers = globalThis.fetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBeUndefined();
  });
});
