import { useState, useEffect, useRef } from 'react';
import { Mail, RefreshCw, Unlink, CheckCircle, XCircle, Loader2, ExternalLink, Users, UserPlus, X, Tag, Bell, BellOff, User, Copy, Check, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getSharingConnections, getPendingInvites, sendSharingInvite,
  acceptInvite, rejectInvite, removeConnection, updateSharedCategories,
  updateLanguage,
} from '../services/api';
import {
  subscribeToPush, unsubscribeFromPush, isThisBrowserSubscribed,
  isPushSupported, getNotificationPermission,
} from '../services/push';
import { DataPrivacyCard } from './ConsentScreen';
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);

  function handleCopyEmail() {
    navigator.clipboard.writeText(user?.email || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const joined = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
  ];

  return (
    <div className="integration-card">
      <div className="integration-header">
        <div className="integration-icon profile-icon"><User size={24} /></div>
        <div className="integration-info">
          <h3>{t('integrations.profile.title')}</h3>
          <p>{t('integrations.profile.signedInAs', { name: user?.name })}</p>
        </div>
      </div>

      <div className="profile-detail-grid">
        <div className="profile-row">
          <span className="profile-label">{t('integrations.profile.email')}</span>
          <span className="profile-value">
            {user?.email}
            <button className="btn-icon-sm" onClick={handleCopyEmail} title={t('integrations.profile.copyEmail')}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </span>
        </div>
        <div className="profile-row">
          <span className="profile-label">{t('integrations.profile.name')}</span>
          <span className="profile-value">{user?.name}</span>
        </div>
        {joined && (
          <div className="profile-row">
            <span className="profile-label">{t('integrations.profile.memberSince')}</span>
            <span className="profile-value">{joined}</span>
          </div>
        )}
        <div className="profile-row">
          <span className="profile-label"><Globe size={14} /> {t('integrations.profile.language')}</span>
          <span className="profile-value">
            <select
              className="lang-select"
              value={i18n.language?.substring(0, 2)}
              onChange={(e) => {
                const lang = e.target.value;
                i18n.changeLanguage(lang);
                updateLanguage(lang).catch(() => {});
              }}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Integrations() {
  const { t } = useTranslation();
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
      .catch(() => setGmailError(t('integrations.gmail.loadError')))
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
        ? t('integrations.sharing.inviteAutoSuccess', { name: result.connection?.toUser?.name || result.reverse?.fromUser?.name || inviteEmail })
        : t('integrations.sharing.inviteSentSuccess', { email: inviteEmail.trim() }));
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
    if (!confirm(t('integrations.sharing.confirmRemove'))) return;
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
      <h2 className="integrations-title">{t('integrations.pageTitle')}</h2>

      {/* ── Profile ───────────────────────────────────────────────────────── */}
      <ProfileCard />

      {/* ── Gmail ─────────────────────────────────────────────────────────── */}
      <div className="integration-card">
        <div className="integration-header">
          <div className="integration-icon gmail-icon"><Mail size={24} /></div>
          <div className="integration-info">
            <h3>{t('integrations.gmail.title')}</h3>
            <p>{t('integrations.gmail.description')}</p>
          </div>
        </div>

        {loadingStatus ? (
          <div className="integration-loading"><Loader2 size={18} className="spin" /> {t('common.loading')}</div>
        ) : gmail?.connected ? (
          <>
            <div className="integration-status connected">
              <CheckCircle size={16} />
              <span>{t('integrations.gmail.connectedAs', { email: gmail.email })}</span>
            </div>
            <div className="integration-how">
              <h4>{t('integrations.gmail.howItWorks')}</h4>
              <ul>
                <li>{t('integrations.gmail.howStep1')}</li>
                <li>{t('integrations.gmail.howStep2')}</li>
                <li>{t('integrations.gmail.howStep3')}</li>
                <li>{t('integrations.gmail.howStep4')}</li>
                <li>{t('integrations.gmail.howStep5')}</li>
              </ul>
            </div>
            {syncResult && syncResult.status === 'completed' && (
              <div className="sync-result">
                <CheckCircle size={16} />
                <span>{t('integrations.gmail.syncResult', { checked: syncResult.scanned, imported: syncResult.found })}</span>
              </div>
            )}
            {syncResult && syncResult.status === 'in_progress' && (
              <div className="sync-result syncing">
                <Loader2 size={16} className="spin" />
                <span>{t('integrations.gmail.syncing')} {syncResult.scanned > 0 ? t('integrations.gmail.syncProgress', { count: syncResult.scanned }) : t('integrations.gmail.syncStarting')}</span>
              </div>
            )}
            {syncResult && syncResult.status === 'error' && (
              <div className="error-message"><XCircle size={16} /> {t('integrations.gmail.syncFailed')}{syncResult.error || t('integrations.gmail.unknownError')}</div>
            )}
            {gmailError && <div className="error-message"><XCircle size={16} /> {gmailError}</div>}
            <div className="integration-actions">
              <button className="btn btn-primary" onClick={handleSync} disabled={syncing}>
                {syncing ? <><Loader2 size={16} className="spin" /> {t('integrations.gmail.syncingBtn')}</> : <><RefreshCw size={16} /> {t('integrations.gmail.syncNow')}</>}
              </button>
              <button className="btn btn-ghost disconnect-btn" onClick={handleGmailDisconnect} disabled={disconnecting}>
                {disconnecting ? <><Loader2 size={16} className="spin" /> {t('integrations.gmail.disconnecting')}</> : <><Unlink size={16} /> {t('integrations.gmail.disconnect')}</>}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="integration-status disconnected"><XCircle size={16} /><span>{t('integrations.gmail.disconnected')}</span></div>
            {gmailError && <div className="error-message"><XCircle size={16} /> {gmailError}</div>}
            <div className="integration-how">
              <h4>{t('integrations.gmail.whatYouNeed')}</h4>
              <ul>
                <li>{t('integrations.gmail.needStep1')}</li>
                <li>{t('integrations.gmail.needStep2')}</li>
              </ul>
            </div>
            <div className="integration-actions">
              <a href="/api/gmail/auth" className="btn btn-primary"><ExternalLink size={16} /> {t('integrations.gmail.connectGmail')}</a>
            </div>
          </>
        )}
      </div>

      {/* ── Sharing ───────────────────────────────────────────────────────── */}
      <div className="integration-card">
        <div className="integration-header">
          <div className="integration-icon sharing-icon"><Users size={24} /></div>
          <div className="integration-info">
            <h3>{t('integrations.sharing.title')}</h3>
            <p>{t('integrations.sharing.description')}</p>
          </div>
        </div>

        {sharingLoading ? (
          <div className="integration-loading"><Loader2 size={18} className="spin" /> {t('common.loading')}</div>
        ) : (
          <>
            {/* Pending invites received */}
            {pendingInvites.length > 0 && (
              <div className="sharing-section">
                <h4 className="sharing-section-title">{t('integrations.sharing.pendingInvites')}</h4>
                {pendingInvites.map((inv) => (
                  <div key={inv.id} className="sharing-invite-row">
                    <div className="sharing-user">
                      <strong>{inv.fromUser.name}</strong>
                      <span>{inv.fromUser.email}</span>
                    </div>
                    <div className="sharing-invite-actions">
                      <button className="btn btn-sm btn-primary" onClick={() => handleAcceptInvite(inv.id)}>{t('integrations.sharing.accept')}</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => handleRejectInvite(inv.id)}>{t('integrations.sharing.decline')}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Connections I'm sharing TO (I invited them) */}
            {sentConns.filter((c) => c.status === 'accepted').length > 0 && (
              <div className="sharing-section">
                <h4 className="sharing-section-title">
                  <Tag size={14} /> {t('integrations.sharing.sharingWith')}
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
                        <button className="btn-icon-sm" onClick={() => handleDisconnectSharing(conn.id)} title={t('integrations.sharing.removeConnection')}>
                          <X size={16} />
                        </button>
                      </div>
                      <div className="sharing-cats-label">{t('integrations.sharing.autoShareLabel')}</div>
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
                          ? t('integrations.sharing.noCatsHint')
                          : t('integrations.sharing.catsHint', { cats: cats.join(', ') })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pending invites I sent */}
            {sentConns.filter((c) => c.status === 'pending').length > 0 && (
              <div className="sharing-section">
                <h4 className="sharing-section-title">{t('integrations.sharing.pendingAwaiting')}</h4>
                {sentConns.filter((c) => c.status === 'pending').map((conn) => (
                  <div key={conn.id} className="sharing-invite-row">
                    <div className="sharing-user">
                      <strong>{conn.toUser.name}</strong>
                      <span>{conn.toUser.email}</span>
                    </div>
                    <button className="btn btn-sm btn-ghost" onClick={() => handleDisconnectSharing(conn.id)}>{t('common.cancel')}</button>
                  </div>
                ))}
              </div>
            )}

            {/* Connections sharing TO me */}
            {receivedConns.length > 0 && (
              <div className="sharing-section">
                <h4 className="sharing-section-title">{t('integrations.sharing.sharedWithYouBy')}</h4>
                {receivedConns.map((conn) => (
                  <div key={conn.id} className="sharing-invite-row">
                    <div className="sharing-user">
                      <strong>{conn.fromUser.name}</strong>
                      <span>{conn.fromUser.email}</span>
                    </div>
                    <button className="btn btn-sm btn-ghost disconnect-btn" onClick={() => handleDisconnectSharing(conn.id)}>
                      <Unlink size={14} /> {t('integrations.sharing.remove')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {inviteError && <div className="error-message"><XCircle size={16} /> {inviteError}</div>}
            {inviteSuccess && <div className="sync-result"><CheckCircle size={16} /> {inviteSuccess}</div>}

            {/* Invite form */}
            <div className="sharing-section">
              <h4 className="sharing-section-title">{t('integrations.sharing.inviteTitle')}</h4>
              <form className="sharing-invite-form" onSubmit={handleInvite}>
                <input
                  ref={inviteInputRef}
                  type="email"
                  placeholder={t('integrations.sharing.invitePlaceholder')}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary" disabled={inviteLoading}>
                  {inviteLoading ? <><Loader2 size={16} className="spin" /> {t('integrations.sharing.sending')}</> : <><UserPlus size={16} /> {t('integrations.sharing.sendInvite')}</>}
                </button>
              </form>
              <p className="sharing-cats-hint">{t('integrations.sharing.inviteHint')}</p>
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
            <h3>{t('integrations.push.title')}</h3>
            <p>{t('integrations.push.description')}</p>
          </div>
        </div>

        {!pushSupported ? (
          <div className="integration-note">
            <XCircle size={15} /> {t('integrations.push.notSupported')}
          </div>
        ) : !serverPushEnabled ? (
          <div className="integration-note">
            <XCircle size={15} /> {t('integrations.push.notConfigured')}
          </div>
        ) : pushPermission === 'denied' ? (
          <div className="integration-note warn">
            <XCircle size={15} /> {t('integrations.push.permissionDenied')}
          </div>
        ) : (
          <div className="integration-actions">
            <div className="notif-status-row">
              <div className={`notif-status-dot ${pushSubscribed ? 'on' : 'off'}`} />
              <span>{pushSubscribed ? t('integrations.push.enabled') : t('integrations.push.disabled')}</span>
            </div>

            {pushSubscribed ? (
              <button
                className="btn btn-sm btn-ghost disconnect-btn"
                onClick={handleDisableNotifications}
                disabled={pushLoading}
              >
                {pushLoading ? <Loader2 size={14} className="spin" /> : <BellOff size={14} />}
                {t('integrations.push.turnOff')}
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleEnableNotifications}
                disabled={pushLoading}
              >
                {pushLoading ? <><Loader2 size={16} className="spin" /> {t('integrations.push.enabling')}</> : <><Bell size={16} /> {t('integrations.push.enable')}</>}
              </button>
            )}
          </div>
        )}

        {pushSubscribed && (
          <div className="notif-info-list">
            <p className="notif-info-title">{t('integrations.push.notifyTitle')}</p>
            <ul>
              <li>{t('integrations.push.notifyReminder')}</li>
              <li>{t('integrations.push.notifyOverdue')}</li>
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