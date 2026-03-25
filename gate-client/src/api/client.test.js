import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the internal request() behaviour by mocking fetch globally.
// The main thing we guard here is that Content-Type is NOT sent on GET
// requests (which have no body), so that Caddy / proxies don't reject them.

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
  // Reset module so import.meta.env is re-evaluated (BASE defaults to '/api')
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(status = 200, body = {}) {
  fetch.mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  });
}

async function importApi() {
  // Dynamic import to get a fresh module each time
  const mod = await import('./client.js?t=' + Math.random());
  return mod.api;
}

describe('api client – Content-Type header', () => {
  it('does NOT set Content-Type on GET requests', async () => {
    mockFetch(200, { rows: [] });
    const api = await importApi();
    await api.getMySubmissions();

    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBeUndefined();
  });

  it('sets Content-Type: application/json on POST requests with a body', async () => {
    mockFetch(200, { token: 'tok', role: 'access_requestor', name: null });
    const api = await importApi();
    await api.login('user@example.com', 'pass');

    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('does NOT set Content-Type for FormData (image upload)', async () => {
    mockFetch(200, { verdict: 'APPROVED' });
    const api = await importApi();
    const fakeFile = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    await api.verifyImage(fakeFile);

    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBeUndefined();
  });

  it('attaches Authorization header when token is in localStorage', async () => {
    localStorage.setItem('gate_token', 'my-jwt');
    mockFetch(200, { rows: [] });
    const api = await importApi();
    await api.getMySubmissions();

    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer my-jwt');
  });

  it('reloads page on 401 and removes token', async () => {
    localStorage.setItem('gate_token', 'expired-jwt');
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { reload: reloadSpy });
    fetch.mockResolvedValue({ status: 401, ok: false, json: () => Promise.resolve({}) });

    const api = await importApi();
    await api.getMySubmissions(); // should not throw

    expect(localStorage.getItem('gate_token')).toBeNull();
    expect(reloadSpy).toHaveBeenCalled();
  });
});
