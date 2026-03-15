const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(method, path, body, isFormData = false) {
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
  return data;
}

export const api = {
  verifyId: (identifierType, identifierValue) =>
    request('POST', '/verify/id', { identifierType, identifierValue }),

  verifyImage: (imageFile) => {
    const form = new FormData();
    form.append('image', imageFile);
    return request('POST', '/verify/image', form, true);
  },
};
