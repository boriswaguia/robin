import { useState, useEffect } from 'react';
import { Mail, RefreshCw, Unlink, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';

async function fetchGmailStatus() {
  const res = await fetch('/api/gmail/status', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch Gmail status');
  return res.json();
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

export default function Integrations() {
  const [gmail, setGmail] = useState(null);   // { connected, email }
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);  // { processed, found }
  const [error, setError] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    // Check for OAuth callback result in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      setSyncResult(null);
      window.history.replaceState({}, '', '/integrations');
    }
    if (params.get('error')) {
      setError(decodeURIComponent(params.get('error')));
      window.history.replaceState({}, '', '/integrations');
    }

    fetchGmailStatus()
      .then(setGmail)
      .catch(() => setError('Could not load Gmail status'))
      .finally(() => setLoadingStatus(false));
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const result = await syncGmail();
      setSyncResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      await disconnectGmail();
      setGmail({ connected: false, email: null });
      setSyncResult(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="integrations-page">
      <h2 className="integrations-title">Integrations</h2>

      <div className="integration-card">
        <div className="integration-header">
          <div className="integration-icon gmail-icon">
            <Mail size={24} />
          </div>
          <div className="integration-info">
            <h3>Gmail</h3>
            <p>Sync actionable emails — invoices, bills, reminders, and letters with attachments — directly into your Robin inbox.</p>
          </div>
        </div>

        {loadingStatus ? (
          <div className="integration-loading">
            <Loader2 size={18} className="spin" /> Loading…
          </div>
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

            {syncResult && (
              <div className="sync-result">
                <CheckCircle size={16} />
                <span>
                  Checked <strong>{syncResult.scanned}</strong> new email{syncResult.scanned !== 1 ? 's' : ''}
                  {syncResult.skipped > 0 && <> ({syncResult.skipped} already synced)</>}
                  {' — '}
                  {syncResult.found === 0
                    ? 'nothing new needs your attention.'
                    : <><strong>{syncResult.found}</strong> item{syncResult.found > 1 ? 's' : ''} added to your inbox.</>}
                </span>
              </div>
            )}

            {error && (
              <div className="error-message">
                <XCircle size={16} /> {error}
              </div>
            )}

            <div className="integration-actions">
              <button
                className="btn btn-primary"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? (
                  <><Loader2 size={16} className="spin" /> Syncing…</>
                ) : (
                  <><RefreshCw size={16} /> Sync Now</>
                )}
              </button>
              <button
                className="btn btn-ghost disconnect-btn"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <><Loader2 size={16} className="spin" /> Disconnecting…</>
                ) : (
                  <><Unlink size={16} /> Disconnect</>
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="integration-status disconnected">
              <XCircle size={16} />
              <span>Not connected</span>
            </div>

            {error && (
              <div className="error-message">
                <XCircle size={16} /> {error}
              </div>
            )}

            <div className="integration-how">
              <h4>What you'll need</h4>
              <ul>
                <li>A Google account with a Gmail inbox</li>
                <li>Robin will only request <strong>read-only</strong> access — it cannot send or delete emails</li>
              </ul>
            </div>

            <div className="integration-actions">
              <a href="/api/gmail/auth" className="btn btn-primary">
                <ExternalLink size={16} /> Connect Gmail
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
