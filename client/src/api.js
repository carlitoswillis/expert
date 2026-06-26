// Tiny fetch wrapper for the expert-search API. Replaces the old jQuery/axios mix.

async function asJson(res) {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function searchSources({ q = '', page = 0, limit = 10 } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (q) params.set('q', q);
  return fetch(`/sources?${params}`).then(asJson);
}

export function getSource(id) {
  return fetch(`/sources/${id}`).then(asJson);
}

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
