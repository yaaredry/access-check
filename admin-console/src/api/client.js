const BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(method, path, body, isFormData = false) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      window.location.replace('/admin/login');
      return;
    }
    throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
  }
  return data;
}

export const api = {
  login: (username, password) => request('POST', '/auth/login', { username, password }),

  listPeople: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/people${qs ? `?${qs}` : ''}`);
  },
  getPerson: (id) => request('GET', `/people/${id}`),
  createPerson: (data) => request('POST', '/people', data),
  updatePerson: (id, data) => request('PUT', `/people/${id}`, data),
  deletePerson: (id) => request('DELETE', `/people/${id}`),
  uploadCSV: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('POST', '/people/upload-csv', form, true);
  },

  importGSheet: (url) => request('POST', '/people/import-gsheet', { url }),
};
