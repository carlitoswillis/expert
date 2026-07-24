// Tiny fetch wrapper for the expert-search API. Replaces the old jQuery/axios mix.

async function asJson(res) {
  if (!res.ok) {
    // The API explains user-fixable problems (bad link, empty paste) in
    // `error`; fall back to the status line when it doesn't.
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

const postJson = (path, body) => fetch(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then(asJson);

export function searchSources({ q = '', page = 0, limit = 10, type = '' } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (q) params.set('q', q);
  if (type) params.set('type', type);
  return fetch(`/sources?${params}`).then(asJson);
}

export function getSource(id) {
  return fetch(`/sources/${id}`).then(asJson);
}

// Where a source's stored file is served from — the reader loads this.
export const sourceFileUrl = (id) => `/sources/${id}/file`;

export function updateSource(id, patch) {
  return fetch(`/sources/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then(asJson);
}

export function deleteSource(id) {
  return fetch(`/sources/${id}`, { method: 'DELETE' }).then(asJson);
}

export function uploadSources(formData) {
  return fetch('/sources', { method: 'POST', body: formData }).then(asJson);
}

// Capture a web article by link — the server fetches and extracts the text.
export function captureUrl(url) {
  return postJson('/sources/url', { url });
}

// Capture pasted text / a note.
export function captureText({ title, text, authors, url }) {
  return postJson('/sources/text', { title, text, authors, url });
}
