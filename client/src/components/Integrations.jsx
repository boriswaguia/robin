import { useState, useEffect, useRef } from 'react';
import { Mail, RefreshCw, Unlink, CheckCircle, XCircle, Loader2, ExternalLink, Users, UserPlus, X, Tag, Bell, BellOff, User, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getSharingConnections, getPendingInvites, sendSharingInvite,
  acceptInvite, rejectInvite, removeConnection, updateSharedCategories,
} from '../services/api';
import {
  subscribeToPush, unsubscribeFromPush, isThisBrowserSubscribed,
  isPushSupported, getNotificationPermission,
} from '../services/push';
import { DataPrivacyCard } from './ConsentScreen';

async function fetchGmailStatus() {
  const res = await fetch('/api/gmail/status', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch Gmail status');
  return res.json();
}

async function fetchSyncStatus() {
  const res = await fetch('/api/gmail/sync-status', { credentials: 'include' });
  if (!res.ok) return null;
  const data = await res.json();
  return data.sync; // { status, scanned, skipped, found, error, ... } or null
}

async function syncGmail() {
  const res = await fetch('/api/gmail/sync', { method: 'POST', credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Sync failed');
  return data;
}

async function disconnectGmail() {
  const res = await fetch('/api/gmail/disconnect', { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error('Disconnect failed');
}

const SHARE_CATEGORIES = ['bill', 'government', 'legal', 'medical', 'insurance', 'financial', 'tax', 'personal', 'subscription', 'other'];

function ProfileCard() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  function handleCopyEmail() {
    navigator.clipboard.writeText(user?.email || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const joined = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="integration-card">
      <div className="integration-header">
        <div className="integration-icon profile-icon"><User size={24} /></div>
        <div className="integration-info">
          <h3>Your Account</h3>
          <p>Signed in as <strong>{user?.name}</strong></p>
        </div>
      </div>

      <div className="profile-detail-grid">
        <div className="profile-row">
          <span className="profile-label">Email</span>
          <span className="profile-value">
            {user?.email}
            <button className="btn-icon-sm" onClick={handleCopyEmail} title="Copy email">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </span>
        </div>
        <div className="profile-row">
          <span className="profile-label">Name</span>
          <span className="profile-value">{user?.name}</span>
        </div>
        {joined && (
          <div className="profile-row">
            <span className="profile-label">Member since</span>
            <span className="profile-value">{joined}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Integrations() {
  // ── Gmail state ────────────────────────────────────────────────────────────
  const [gmail, setGmail]               = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncing, setSyncing]           = useState(false);
  const [syncResult, setSyncResult]     = useState(null);
  const [gmailError, setGmailError]     = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // ── Sharing state ──────────────────────────────────────────────────────────
  const [sharingLoading, setSharingLoading] = useState(true);
  const [sentConns, setSentConns]       = useState([]);   // connections I initiated
  const [receivedConns, setReceivedConns] = useState([]); // connections others initiated (accepted)
  const [pendingInvites, setPendingInvites] = useState([]); // pending invites sent TO me
  const [inviteEmail, setInviteEmail]   = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError]   = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(null);
  const [catUpdating, setCatUpdating]   = useState(null); // connectionId being updated
  const inviteInputRef = useRef(null);

  // ── Notifications state ────────────────────────────────────────────────────
  const [pushSupported]                 = useState(isPushSupported);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushPermission, setPushPermission] = useState(getNotificationPermission());
  const [pushLoading, setPushLoading]   = useState(false);
  const [pushError, setPushError]       = useState(null);
  const [serverPushEnabled, setServerPushEnabled] = useState(true);

  // Check if this browser is already subscribed
  useEffect(() => {
    if (!pushSupported) return;
    isThisBrowserSubscribed().then(setPushSubscribed);
    // Also check server config
    fetch('/api/push/vapid-public-key', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setServerPushEnabled(d.enabled); })
      .catch(() => setServerPushEnabled(false));
  }, [pushSupported]);

  // ── Load Gmail status ──────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      setSyncResult(null);
      window.history.replaceState({}, '', '/integrations');
    }
    if (params.get('error')) {
      setGmailError(decodeURIComponent(params.get('error')));
      window.history.replaceState({}, '', '/integrations');
    }
    fetchGmailStatus()
      .then(setGmail)
      .catch(() => setGmailError('Could not load Gmail status'))
      .finally(() => setLoadingStatus(false));
  }, []);

  // ── Load sharing data ──────────────────────────────────────────────────────
  async function loadSharing() {
    setSharingLoading(true);
    try {
      const [conns, invites] = await Promise.all([getSharingConnections(), getPendingInvites()]);
      setSentConns(conns.sent || []);
      setReceivedConns(conns.received || []);
      setPendingInvites(invites || []);
    } catch { /* ignore */ }
    setSharingLoading(false);
  }
  useEffect(() => { loadSharing(); }, []);

  // ── Gmail handlers ─────────────────────────────────────────────────────────
  const syncPollRef = useRef(null);

  // Load latest sync status on mount (show last result)
  useEffect(() => {
    if (!gmail?.connected) return;
    fetchSyncStatus().then((s) => {
      if (!s) return;
      if (s.status === 'in_progress') {
        setSyncing(true);
        startSyncPolling();
      } else {
        setSyncResult(s);
      }
    });
    return () => clearInterval(syncPollRef.current);
  }, [gmail?.connected]);

  function startSyncPolling() {
    clearInterval(syncPollRef.current);
    syncPollRef.current = setInterval(async () => {
      const s = await fetchSyncStatus();
      if (!s) return;
      if (s.status !== 'in_progress') {
        clearInterval(syncPollRef.current);
        setSyncing(false);
        setSyncResult(s);
      } else {
        // Update live progress counts
        setSyncResult(s);
      }
    }, 2500);
  }

  async function handleSync() {
    setSyncing(true); setSyncResult(null); setGmailError(null);
    try {
      await syncGmail();
      startSyncPolling();
    }
    catch (err) { setGmailError(err.message); setSyncing(false); }
  }

  async function handleGmailDisconnect() {
    setDisconnecting(true); setGmailError(null);
    try { await disconnectGmail(); setGmail({ connected: false, email: null }); setSyncResult(null); }
    catch (err) { setGmailError(err.message); }
    finally { setDisconnecting(false); }
  }

  // ── Sharing handlers ───────────────────────────────────────────────────────
  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true); setInviteError(null); setInviteSuccess(null);
    try {
      const result = await sendSharingInvite(inviteEmail.trim());
      setInviteEmail('');
      setInviteSuccess(result.autoAccepted
        ? `Connected with ${result.connection?.toUser?.name || result.reverse?.fromUser?.name || inviteEmail}! Both of you can now manage what you share.`
        : `Invite sent to ${inviteEmail.trim()}.`);
      await loadSharing();
    } catch (err) { setInviteError(err.message); }
    finally { setInviteLoading(false); }
  }

  async function handleAcceptInvite(id) {
    try { await acceptInvite(id); await loadSharing(); }
    catch (err) { setInviteError(err.message); }
  }

  async function handleRejectInvite(id) {
    try { await rejectInvite(id); await loadSharing(); }
    catch (err) { setInviteError(err.message); }
  }

  async function handleDisconnectSharing(id) {
    if (!confirm('Remove this sharing connection?')) return;
    try { await removeConnection(id); await loadSharing(); }
    catch (err) { setInviteError(err.message); }
  }

  async function handleCategoryToggle(connectionId, category, currentCategories) {
    setCatUpdating(connectionId);
    const updated = currentCategories.includes(category)
      ? currentCategories.filter((c) => c !== category)
      : [...currentCategories, category];
    try {
      const res = await updateSharedCategories(connectionId, updated);
      setSentConns((prev) => prev.map((c) => c.id === connectionId
        ? { ...c, sharedCategories: res.sharedCategories }
        : c));
    } catch (err) { setInviteError(err.message); }
    finally { setCatUpdating(null); }
  }

  // ── Notification handlers ──────────────────────────────────────────────────
  async function handleEnableNotifications() {
    setPushLoading(true); setPushError(null);
    try {
      await subscribeToPush();
      setPushSubscribed(true);
      setPushPermission(getNotificationPermission());
    } catch (err) {
      setPushError(err.message);
    } finally {
      setPushLoading(false);
    }
  }

  async function handleDisableNotifications() {
    setPushLoading(true); setPushError(null);
    try {
      await unsubscribeFromPush();
      setPushSubscribed(false);
    } catch (err) {
      setPushError(err.message);
    } finally {
      setPushLoading(false);
    }
  }

  return (
    <div className="integrations-page">
      <h2 className="integrations-title">Settings</h2>

      {/* ── Profile ───────────────────────────────────────────────────────── */}
      <ProfileCard />

      {/* ── Gmail ─────────────────────────────────────────────────────────── */}
      <div className="integration-card">
        <div className="integration-header">
          <div className="integration-icon gmail-icon"><Mail size={24} /></div>
          <div className="integration-info">
            <h3>Gmail</h3>
            <p>Sync actionable emails — invoices, bills, reminders, and letters with attachments — directly into your Robin inbox.</p>
          </div>
        </div>

        {loadingStatus ? (
          <div className="integration-loading"><Loader2 size={18} className="spin" /> Loading…</div>
        ) : gmail?.connected ? (
          <>
            <div className="integration-status connected">
              <CheckCircle size={16} />
              <span>Connected as <strong>{gmail.email}</strong></span>
            </div>
            <div className="integration-how">
              <h4>How it works</h4>
              <ul>
                <li>Scans your last 7 days of Primary &amp; Updates inbox</li>
                <li>Automatically skips newsletters, promotions, and social emails</li>
                <li>Uses AI to identify emails that genuinely need your attention</li>
                <li>Analyzes email body and any PDF/image attachments</li>
                <li>Results appear in your Dashboard alongside scanned mail</li>
              </ul>
            </div>
            {syncResult && syncResult.status === 'completed' && (
              <div className="sync-result">
                <CheckCircle size={16} />
                <span>Checked {syncResult.scanned} email{syncResult.scanned !== 1 ? 's' : ''}, imported {syncResult.found} item{syncResult.found !== 1 ? 's' : ''}.</span>
              </div>
            )}
            {syncResult && syncResult.status === 'in_progress' && (
              <div className="sync-result syncing">
                <Loader2 size={16} className="spin" />
                <span>Syncing… {syncResult.scanned > 0 ? `${syncResult.scanned} checked so far` : 'starting'}</span>
              </div>
            )}
            {syncResult && syncResult.status === 'error' && (
              <div className="error-message"><XCircle size={16} /> Sync failed: {syncResult.error || 'Unknown error'}</div>
            )}
            {gmailError && <div className="error-message"><XCircle size={16} /> {gmailError}</div>}
            <div className="integration-actions">
              <button className="btn btn-primary" onClick={handleSync} disabled={syncing}>
                {syncing ? <><Loader2 size={16} className="spin" /> Syncing…</> : <><RefreshCw size={16} /> Sync Now</>}
              </button>
              <button className="btn btn-ghost disconnect-btn" onClick={handleGmailDisconnect} disabled={disconnecting}>
                {disconnecting ? <><Loader2 size={16} className="spin" /> Disconnecting…</> : <><Unlink size={16} /> Disconnect</>}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="integration-status disconnected"><XCircle size={16} /><span>Not connected</span></div>
            {gmailError && <div className="error-message"><XCircle size={16} /> {gmailError}</div>}
            <div className="integration-how">
              <h4>What you'll need</h4>
              <ul>
                <li>A Google account with a Gmail inbox</li>
                <li>Robin will only request <strong>read-only</strong> access — it cannot send or delete emails</li>
              </ul>
            </div>
            <div className="integration-actions">
              <a href="/api/gmail/auth" className="btn btn-primary"><ExternalLink size={16} /> Connect Gmail</a>
            </div>
          </>
        )}
      </div>

      {/* ── Sharing ───────────────────────────────────────────────────────── */}
      <div className="integration-card">
        <div className="integration-header">
          <div className="integration-icon sharing-icon"><Users size={24} /></div>
          <div className="integration-info">
            <h3>Dashboard Sharing</h3>
            <p>Share your mail with a partner, family member, or flatmate. They get a read-only view of what you choose to share.</p>
          </div>
        </div>

        {sharingLoading ? (
          <div className="integration-loading"><Loader2 size={18} className="spin" /> Loading…</div>
        ) : (
          <>
            {/* Pending invites received */}
            {pendingInvites.length > 0 && (
              <div className="sharing-section">
                <h4 className="sharing-section-title">Pending invites</h4>
                {pendingInvites.map((inv) => (
                  <div key={inv.id} className="sharing-invite-row">
                    <div className="sharing-user">
                      <strong>{inv.fromUser.name}</strong>
                      <span>{inv.fromUser.email}</span>
                    </div>
                    <div className="sharing-invite-actions">
                      <button className="btn btn-sm btn-primary" onClick={() => handleAcceptInvite(inv.id)}>Accept</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => handleRejectInvite(inv.id)}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Connections I'm sharing TO (I invited them) */}
            {sentConns.filter((c) => c.status === 'accepted').length > 0 && (
              <div className="sharing-section">
                <h4 className="sharing-section-title">
                  <Tag size={14} /> You are sharing with
                </h4>
                {sentConns.filter((c) => c.status === 'accepted').map((conn) => {
                  const cats = conn.sharedCategories || [];
                  const isUpdating = catUpdating === conn.id;
                  return (
                    <div key={conn.id} className="sharing-conn-card">
                      <div className="sharing-conn-header">
                        <div className="sharing-user">
                          <strong>{conn.toUser.name}</strong>
                          <span>{conn.toUser.email}</span>
                        </div>
                        <button className="btn-icon-sm" onClick={() => handleDisconnectSharing(conn.id)} title="Remove connection">
                          <X size={16} />
                        </button>
                      </div>
                      <div className="sharing-cats-label">Auto-share categories:</div>
                      <div className="sharing-cats">
                        {SHARE_CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            className={`cat-chip ${cats.includes(cat) ? 'active' : ''}`}
                            onClick={() => handleCategoryToggle(conn.id, cat, cats)}
                            disabled={isUpdating}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                      <p className="sharing-cats-hint">
                        {cats.length === 0
                          ? 'No categories auto-shared — use the share button on individual mail items.'
                          : `Auto-sharing: ${cats.join(', ')}. You can also share individual items manually.`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pending invites I sent */}
            {sentConns.filter((c) => c.status === 'pending').length > 0 && (
              <div className="sharing-section">
                <h4 className="sharing-section-title">Pending (awaiting response)</h4>
                {sentConns.filter((c) => c.status === 'pending').map((conn) => (
                  <div key={conn.id} className="sharing-invite-row">
                    <div className="sharing-user">
                      <strong>{conn.toUser.name}</strong>
                      <span>{conn.toUser.email}</span>
                    </div>
                    <button className="btn btn-sm btn-ghost" onClick={() => handleDisconnectSharing(conn.id)}>Cancel</button>
                  </div>
                ))}
              </div>
            )}

            {/* Connections sharing TO me */}
            {receivedConns.length > 0 && (
              <div className="sharing-section">
                <h4 className="sharing-section-title">Shared with you by</h4>
                {receivedConns.map((conn) => (
                  <div key={conn.id} className="sharing-invite-row">
                    <div className="sharing-user">
                      <strong>{conn.fromUser.name}</strong>
                      <span>{conn.fromUser.email}</span>
                    </div>
                    <button className="btn btn-sm btn-ghost disconnect-btn" onClick={() => handleDisconnectSharing(conn.id)}>
                      <Unlink size={14} /> Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {inviteError && <div className="error-message"><XCircle size={16} /> {inviteError}</div>}
            {inviteSuccess && <div className="sync-result"><CheckCircle size={16} /> {inviteSuccess}</div>}

            {/* Invite form */}
            <div className="sharing-section">
              <h4 className="sharing-section-title">Invite someone</h4>
              <form className="sharing-invite-form" onSubmit={handleInvite}>
                <input
                  ref={inviteInputRef}
                  type="email"
                  placeholder="their@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary" disabled={inviteLoading}>
                  {inviteLoading ? <><Loader2 size={16} className="spin" /> Sending…</> : <><UserPlus size={16} /> Send Invite</>}
                </button>
              </form>
              <p className="sharing-cats-hint">They need a Robin account. Once accepted, you'll each control what you share.</p>
            </div>
          </>
        )}
      </div>

      {/* ── Push Notifications ───────────────────────────────────────────── */}
      <div className="integration-card">
        <div className="integration-header">
          <div className={`integration-icon ${pushSubscribed ? 'notif-icon-on' : 'notif-icon-off'}`}>
            {pushSubscribed ? <Bell size={24} /> : <BellOff size={24} />}
          </div>
          <div className="integration-info">
            <h3>Push Notifications</h3>
            <p>Get notified on this device when a reminder is due or a deadline has passed without action — even when the app is closed.</p>
          </div>
        </div>

        {!pushSupported ? (
          <div className="integration-note">
            <XCircle size={15} /> Push notifications are not supported in this browser.
          </div>
        ) : !serverPushEnabled ? (
          <div className="integration-note">
            <XCircle size={15} /> Push notifications are not configured on the server. Set <code>VAPID_PUBLIC_KEY</code>, <code>VAPID_PRIVATE_KEY</code>, and <code>VAPID_EMAIL</code> in your <code>.env</code> file.
          </div>
        ) : pushPermission === 'denied' ? (
          <div className="integration-note warn">
            <XCircle size={15} /> Notification permission was denied. Please enable it in your browser settings and reload.
          </div>
        ) : (
          <div className="integration-actions">
            <div className="notif-status-row">
              <div className={`notif-status-dot ${pushSubscribed ? 'on' : 'off'}`} />
              <span>{pushSubscribed ? 'Notifications enabled on this device' : 'Notifications are off'}</span>
            </div>

            {pushSubscribed ? (
              <button
                className="btn btn-sm btn-ghost disconnect-btn"
                onClick={handleDisableNotifications}
                disabled={pushLoading}
              >
                {pushLoading ? <Loader2 size={14} className="spin" /> : <BellOff size={14} />}
                Turn off
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleEnableNotifications}
                disabled={pushLoading}
              >
                {pushLoading ? <><Loader2 size={16} className="spin" /> Enabling…</> : <><Bell size={16} /> Enable notifications</>}
              </button>
            )}
          </div>
        )}

        {pushSubscribed && (
          <div className="notif-info-list">
            <p className="notif-info-title">You will be notified when:</p>
            <ul>
              <li>⏰ A reminder you set is due</li>
              <li>🚨 A due date has passed and you haven't acted yet</li>
            </ul>
          </div>
        )}

        {pushError && <div className="error-message"><XCircle size={16} /> {pushError}</div>}
      </div>

      {/* ── Data & Privacy ─────────────────────────────────────────────── */}
      <DataPrivacyCard />
    </div>
  );
}