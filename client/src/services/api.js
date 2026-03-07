const API_BASE = '/api/mail';

// All requests include credentials so the httpOnly session cookie is sent automatically
const OPTS = { credentials: 'include' };

export async function scanMail(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);

  const res = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    ...OPTS,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Failed to scan mail');
  }

  return res.json();
}

export async function getAllMail() {
  const res = await fetch(API_BASE, OPTS);
  if (!res.ok) throw new Error('Failed to fetch mail');
  return res.json();
}

export async function getMailById(id) {
  const res = await fetch(`${API_BASE}/${id}`, OPTS);
  if (!res.ok) throw new Error('Mail not found');
  return res.json();
}

export async function performAction(id, action, note = '') {
  const res = await fetch(`${API_BASE}/${id}/action`, {
    method: 'PATCH',
    ...OPTS,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, note }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Action failed' }));
    throw new Error(err.error || 'Failed to perform action');
  }

  return res.json();
}

export async function deleteMailItem(id) {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE', ...OPTS });
  if (!res.ok) throw new Error('Failed to delete');
  return res.json();
}

export async function searchMail(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
  const res = await fetch(`${API_BASE}/search?${qs}`, OPTS);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function getContacts() {
  const res = await fetch(`${API_BASE}/contacts`, OPTS);
  if (!res.ok) throw new Error('Failed to fetch contacts');
  return res.json();
}

export async function getMailByContact(name) {
  const res = await fetch(`${API_BASE}/contacts/${encodeURIComponent(name)}`, OPTS);
  if (!res.ok) throw new Error('Failed to fetch contact mail');
  return res.json();
}
