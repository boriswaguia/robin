import { useState } from 'react';
import { Shield, FileText, Download, Trash2, Loader2, AlertTriangle } from 'lucide-react';

const TERMS_VERSION = '1.0';

const TERMS_TEXT = `
## Terms of Use & Privacy Notice
**Version ${TERMS_VERSION} — Last updated: March 2026**

### 1. Service Description
Robin ("the App") is a personal mail scanning and management tool. It uses AI (Google Gemini) to analyze images of your mail and extract structured information.

### 2. Disclaimer of Liability
THE APP IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. THE DEVELOPER(S) AND OPERATOR(S) OF THIS APPLICATION:
- **Take no ownership or responsibility** for any damage, loss, or liability arising from the use or inability to use this application.
- **Are not liable** for any inaccuracies, errors, or omissions in the AI-generated analysis of your documents.
- **Are not liable** for any financial, legal, or personal consequences resulting from actions taken based on information provided by the App.
- **Do not guarantee** the availability, reliability, or accuracy of the service.
- **Are not responsible** for any data loss, security breaches, or unauthorized access, though reasonable security measures are implemented.

You use this application entirely at your own risk.

### 3. Data Processing & Privacy (GDPR)
We process your personal data in accordance with the EU General Data Protection Regulation (GDPR):

**What data we collect:**
- Account information (name, email, hashed password)
- Scanned mail images and extracted text
- AI-generated analysis (summaries, categories, extracted fields)
- Gmail data (if you connect Gmail — read-only access)
- Sharing connections with other users

**Legal basis for processing:**
- Your explicit consent (Article 6(1)(a) GDPR)
- Performance of the service you requested (Article 6(1)(b) GDPR)

**How we process your data:**
- Mail images are analyzed by Google Gemini AI to extract text and structured data
- Data is encrypted at rest using AES-256-GCM encryption
- Passwords are hashed with bcrypt (cost factor 12)
- Sessions use httpOnly, Secure, SameSite=Strict cookies

**Third-party data sharing:**
- **Google Gemini API**: Your mail images and email text are sent to Google's AI service for analysis. Google's privacy policy applies to this processing.
- **No other third parties** receive your data.

### 4. Your Rights (GDPR Articles 15–22)
You have the right to:
- **Access** your data — export all personal data at any time
- **Rectify** inaccurate data — edit any mail analysis via the app
- **Erase** your data — permanently delete your account and all associated data
- **Restrict processing** — disconnect integrations, stop scanning
- **Data portability** — export your data in JSON format
- **Withdraw consent** — you may delete your account at any time

### 5. Data Retention
- Your data is retained as long as your account exists
- When you delete your account, all data (mail, images, connections) is permanently and irreversibly deleted
- Uploaded files are removed from disk upon mail item deletion

### 6. Contact
For any data protection inquiries, contact the application administrator.
`;

export default function ConsentScreen({ onConsent }) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleAccept() {
    if (!accepted) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accepted: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record consent');
      onConsent(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="consent-overlay">
      <div className="consent-card">
        <div className="consent-header">
          <Shield size={28} />
          <h2>Terms & Privacy</h2>
        </div>

        <div className="consent-body">
          <div className="consent-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(TERMS_TEXT) }} />
        </div>

        <div className="consent-disclaimer">
          <AlertTriangle size={16} />
          <span>
            <strong>Important:</strong> By checking the box below you acknowledge that the developer(s) take no ownership or responsibility for any damage arising from the use of this application.
          </span>
        </div>

        <label className="consent-checkbox">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>
            I have read and accept the Terms of Use and Privacy Notice. I consent to my data being processed as described above, including analysis by Google Gemini AI. I understand I can withdraw consent by deleting my account.
          </span>
        </label>

        {error && <div className="error-message">{error}</div>}

        <button
          className="btn btn-primary consent-submit"
          onClick={handleAccept}
          disabled={!accepted || loading}
        >
          {loading ? (
            <><Loader2 size={18} className="spin" /> Accepting…</>
          ) : (
            <><FileText size={18} /> Accept & Continue</>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Mini markdown renderer for the terms text.
 * Handles ##, ###, **, -, and line breaks.
 */
function renderMarkdown(md) {
  return md
    .split('\n')
    .map((line) => {
      if (line.startsWith('### ')) return `<h4>${line.slice(4)}</h4>`;
      if (line.startsWith('## ')) return `<h3>${line.slice(3)}</h3>`;
      if (line.startsWith('- ')) return `<li>${inlineMd(line.slice(2))}</li>`;
      if (line.trim() === '') return '<br/>';
      return `<p>${inlineMd(line)}</p>`;
    })
    .join('')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');
}

function inlineMd(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

/**
 * Data privacy actions — shown in the Integrations page.
 */
export function DataPrivacyCard() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/auth/export', { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'robin-data-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    const confirmed = confirm(
      'PERMANENTLY DELETE YOUR ACCOUNT?\n\n' +
      'This will irreversibly delete:\n' +
      '• Your account and profile\n' +
      '• All scanned mail and analysis\n' +
      '• All uploaded images\n' +
      '• All sharing connections\n\n' +
      'This action cannot be undone. Type "delete" in the next prompt to confirm.'
    );
    if (!confirmed) return;

    const typed = prompt('Type "delete" to confirm permanent account deletion:');
    if (typed?.toLowerCase() !== 'delete') return;

    setDeleting(true);
    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Deletion failed');
      // Reload to trigger logout
      window.location.reload();
    } catch (err) {
      alert('Failed to delete account: ' + err.message);
      setDeleting(false);
    }
  }

  return (
    <div className="integration-card">
      <div className="integration-header">
        <div className="integration-icon privacy-icon"><Shield size={24} /></div>
        <div className="integration-info">
          <h3>Data & Privacy</h3>
          <p>GDPR rights — export or delete your personal data. Your data is encrypted at rest.</p>
        </div>
      </div>
      <div className="privacy-actions">
        <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
          {exporting ? <><Loader2 size={16} className="spin" /> Exporting…</> : <><Download size={16} /> Export My Data</>}
        </button>
        <button className="btn btn-danger" onClick={handleDeleteAccount} disabled={deleting}>
          {deleting ? <><Loader2 size={16} className="spin" /> Deleting…</> : <><Trash2 size={16} /> Delete My Account</>}
        </button>
      </div>
    </div>
  );
}
