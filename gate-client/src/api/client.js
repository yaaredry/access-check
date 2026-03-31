const BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('gate_token');
}

async function request(method, path, body, isFormData = false, signal = null) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 401) {
    localStorage.removeItem('gate_token');
    localStorage.removeItem('gate_role');
    localStorage.removeItem('gate_name');
    window.location.reload();
    return;
  }

  const data = await res.json();
  if (!res.ok) {
    const message = data.error
      || (Array.isArray(data.errors) ? data.errors.map(e => e.msg).join(', ') : null)
      || 'Request failed';
    console.error('[api]', method, path, res.status, data);
    throw Object.assign(new Error(message), { status: res.status, data });
  }
  return data;
}

export const api = {
  login: (username, password) => request('POST', '/auth/login', { username, password }),

  verifyId: (identifierType, identifierValue) =>
    request('POST', '/verify/id', { identifierType, identifierValue }),

  verifyImage: (imageFile, signal) => {
    const form = new FormData();
    form.append('image', imageFile);
    return request('POST', '/verify/image', form, true, signal);
  },

  submitAccessRequest: (data) => request('POST', '/access-requests', data),
  resubmitAccessRequest: (id, data) => request('POST', `/access-requests/${id}/resubmit`, data),
  getMySubmissions: () => request('GET', '/access-requests/mine'),
};
