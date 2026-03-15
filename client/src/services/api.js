const API_BASE = '/api/mail';

// All requests include credentials so the httpOnly session cookie is sent automatically
const OPTS = { credentials: 'include' };

export async function scanMail(files) {
  const formData = new FormData();
  // Support single file or array of files
  const fileList = Array.isArray(files) ? files : [files];
  fileList.forEach((f) => formData.append('images', f));

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

export async function submitVoiceMemo(audioBlob, mimeType = 'audio/webm') {
  const formData = new FormData();
  const ext = mimeType.split('/')[1]?.split(';')[0] || 'webm';
  formData.append('audio', audioBlob, `voice-memo.${ext}`);

  const res = await fetch(`${API_BASE}/voice`, {
    method: 'POST',
    ...OPTS,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Failed to analyze voice memo');
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

export async function reopenMail(id) {
  const res = await fetch(`${API_BASE}/${id}/reopen`, {
    method: 'PATCH',
    ...OPTS,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Reopen failed' }));
    throw new Error(err.error || 'Failed to reopen item');
  }

  return res.json();
}

export async function deleteMailItem(id) {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE', ...OPTS });
  if (!res.ok) throw new Error('Failed to delete');
  return res.json();
}

export async function rescanMail(id) {
  const res = await fetch(`${API_BASE}/${id}/rescan`, { method: 'POST', ...OPTS });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Rescan failed' }));
    throw new Error(err.error || 'Failed to rescan');
  }
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

export async function editMail(id, fields) {
  const res = await fetch(`${API_BASE}/${id}/edit`, {
    method: 'PATCH',
    ...OPTS,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Edit failed' }));
    throw new Error(err.error || 'Failed to edit mail');
  }
  return res.json();
}

export async function setReminder(id, reminderAt) {
  const res = await fetch(`${API_BASE}/${id}/reminder`, {
    method: 'PATCH',
    ...OPTS,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reminderAt }),
  });
  if (!res.ok) throw new Error('Failed to set reminder');
  return res.json();
}

export async function getDueReminders() {
  const res = await fetch(`${API_BASE}/reminders/due`, OPTS);
  if (!res.ok) throw new Error('Failed to fetch reminders');
  return res.json();
}

export async function getAgenda() {
  const res = await fetch(`${API_BASE}/agenda`, OPTS);
  if (!res.ok) throw new Error('Failed to fetch agenda');
  return res.json();
}

// ── Sharing ─────────────────────────────────────────────────────────────────

const SHARE_BASE = '/api/sharing';

export async function getSharingConnections() {
  const res = await fetch(`${SHARE_BASE}/connections`, OPTS);
  if (!res.ok) throw new Error('Failed to fetch connections');
  return res.json(); // { sent, received }
}

export async function getPendingInvites() {
  const res = await fetch(`${SHARE_BASE}/pending`, OPTS);
  if (!res.ok) throw new Error('Failed to fetch invites');
  return res.json();
}

export async function sendSharingInvite(email) {
  const res = await fetch(`${SHARE_BASE}/invite`, {
    method: 'POST', ...OPTS,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Invite failed');
  return data;
}

export async function acceptInvite(id) {
  const res = await fetch(`${SHARE_BASE}/${id}/accept`, { method: 'PATCH', ...OPTS });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to accept');
  return data;
}

export async function rejectInvite(id) {
  const res = await fetch(`${SHARE_BASE}/${id}/reject`, { method: 'DELETE', ...OPTS });
  if (!res.ok) throw new Error('Failed to reject');
  return res.json();
}

export async function removeConnection(id) {
  const res = await fetch(`${SHARE_BASE}/${id}`, { method: 'DELETE', ...OPTS });
  if (!res.ok) throw new Error('Failed to remove connection');
  return res.json();
}

export async function updateSharedCategories(connectionId, categories) {
  const res = await fetch(`${SHARE_BASE}/${connectionId}/categories`, {
    method: 'PATCH', ...OPTS,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update categories');
  return data;
}

export async function getSharedWithMe() {
  const res = await fetch(`${SHARE_BASE}/shared-with-me`, OPTS);
  if (!res.ok) throw new Error('Failed to fetch shared mail');
  return res.json();
}

export async function getMailShares(mailId) {
  const res = await fetch(`${SHARE_BASE}/mail/${mailId}/shares`, OPTS);
  if (!res.ok) throw new Error('Failed to fetch shares');
  return res.json(); // { sharedWith: [userId, ...] }
}

export async function toggleMailShare(mailId, sharedWithUserId, shared) {
  const res = await fetch(`${SHARE_BASE}/mail/${mailId}/share`, {
    method: 'POST', ...OPTS,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sharedWithUserId, shared }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update share');
  return data; // { sharedWith: [userId, ...] }
}
