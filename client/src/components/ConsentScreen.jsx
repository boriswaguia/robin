import { useState } from 'react';
import { Shield, FileText, Download, Trash2, Loader2, AlertTriangle } from 'lucide-react';

const TERMS_VERSION = '1.1';

const TERMS_TEXT = `
## Terms of Use & Privacy Notice
**Version ${TERMS_VERSION} — Last updated: March 2026**

### 1. Service Description
Robin ("the App") is a personal mail scanning and management tool. It uses AI (Google Gemini) to analyze images of your mail and email content to extract structured information such as due dates, amounts, sender details, and suggested actions.

### 2. Disclaimer of Liability
THE APP IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. THE DEVELOPER(S) AND OPERATOR(S) OF THIS APPLICATION:
- **Take no ownership or responsibility** for any damage, loss, or liability arising from the use or inability to use this application.
- **Are not liable** for any inaccuracies, errors, or omissions in the AI-generated analysis of your documents.
- **Are not liable** for any financial, legal, or personal consequences resulting from actions taken based on information provided by the App.
- **Do not guarantee** the availability, reliability, or accuracy of the service.
- **Are not responsible** for any data loss, security breaches, or unauthorized access, though reasonable security measures are implemented.

You use this application entirely at your own risk.

### 3. Data Processing & Privacy (DSGVO / GDPR)
We process your personal data in accordance with the EU General Data Protection Regulation (GDPR / DSGVO):

**What data we collect:**
- Account information (name, email, hashed password)
- Scanned mail images and extracted text
- AI-generated analysis (summaries, categories, extracted fields such as IBANs, reference numbers, addresses, amounts)
- Gmail data (if you connect Gmail — see Section 3a below)
- Sharing connections with other users

**Legal basis for processing:**
- Your explicit consent (Article 6(1)(a) GDPR)
- Performance of the service you requested (Article 6(1)(b) GDPR)

**How we process your data:**
- Mail images are analyzed by Google Gemini AI to extract text and structured data
- All personal data fields (extracted text, summaries, sender/receiver info, financial details) are encrypted at rest using AES-256-GCM encryption
- Gmail OAuth tokens are encrypted at rest using AES-256-GCM encryption
- Uploaded files (images, PDFs) are encrypted on disk using AES-256-GCM
- Passwords are hashed with bcrypt (cost factor 12)
- Sessions use httpOnly, Secure, SameSite=Strict cookies
- No email content, user data, or analysis results are written to application logs

**Third-party data sharing:**
- **Google Gemini API**: Your mail images, scanned document images, and email text content are sent to Google's Gemini AI service for analysis. This includes the full text body of emails (up to 8,000 characters), email subject lines, sender information, and any attached PDF or image files. Google processes this data under their Data Processing Terms. Google's privacy policy applies: https://policies.google.com/privacy
- **No other third parties** receive your data. We do not sell, share, or transfer your data to advertisers, data brokers, or any other entity.

### 3a. Gmail Integration — Specific Data Processing
If you choose to connect your Gmail account, the following additional processing occurs:

**Gmail permissions (OAuth scopes) requested:**
- **gmail.readonly** — read-only access to your Gmail messages (Robin cannot send, delete, or modify your emails)
- **userinfo.email** — to identify which Gmail account is connected

**How Gmail data is processed:**
- Robin scans your inbox for the last 7 days
- **Tier 1 (local filter):** Newsletters, promotions, social, and forum emails are automatically skipped using email headers and Gmail labels — no data leaves the server
- **Tier 2 (AI pre-filter):** For remaining emails, the subject line, sender name, and email snippet (2-3 lines) are sent to Google Gemini to determine if the email requires action. Emails that do not require action are discarded and not stored
- **Tier 3 (full analysis):** For actionable emails only, the full email body text (up to 8,000 characters) and any PDF/image attachments are sent to Google Gemini for detailed analysis
- Only emails identified as genuinely actionable (bills, appointments, legal notices, etc.) are stored in your Robin account
- Gmail OAuth tokens (access token and refresh token) are encrypted at rest and are never logged
- You can disconnect Gmail at any time, which immediately deletes all stored tokens

**What Robin does NOT do with your Gmail:**
- Does not store or index your full mailbox
- Does not read emails older than 7 days
- Does not send emails on your behalf
- Does not modify or delete your emails
- Does not share your email content with anyone other than Google Gemini for analysis
- Does not log email content, subjects, or sender information to server logs

### 4. Automated Decision-Making (Article 22 GDPR)
Robin uses automated processing (AI) to:
- **Categorize** your mail (e.g. bill, government, medical, legal)
- **Assess urgency** (low, medium, high)
- **Extract key details** (due dates, amounts, reference numbers)
- **Filter Gmail** to identify actionable emails (Tier 1 + Tier 2 filtering)

These are assistive suggestions only. You can edit any AI-generated analysis, recategorize items, and override any automated decision. No legally binding decisions are made solely by automated processing.

### 5. Your Rights (GDPR Articles 15–22)
You have the right to:
- **Access** your data — export all personal data at any time via the app
- **Rectify** inaccurate data — edit any AI-generated analysis directly via the app
- **Erase** your data — permanently delete your account and all associated data
- **Restrict processing** — disconnect Gmail, stop scanning, or delete individual items
- **Data portability** — export your data in machine-readable JSON format
- **Object** to processing — you may disconnect integrations or delete your account
- **Withdraw consent** — you may delete your account at any time; this is immediate and irreversible

### 6. Data Retention
- Your data is retained only as long as your account exists
- When you delete your account, all data (mail items, images, Gmail tokens, sharing connections) is permanently and irreversibly deleted
- Uploaded files are removed from disk upon mail item deletion
- No backups of user data are retained after deletion
- Gmail tokens are deleted immediately when you disconnect Gmail

### 7. Data Transfer
Your data may be transferred to servers operated by Google (Gemini API) which may be located outside the European Economic Area (EEA). Google provides appropriate safeguards for international data transfers under their Data Processing Terms, including Standard Contractual Clauses (SCCs).

### 8. Data Security Measures
- AES-256-GCM encryption at rest for all sensitive fields
- File-level encryption for uploaded documents
- bcrypt password hashing (cost factor 12)
- httpOnly, Secure, SameSite=Strict session cookies
- Rate limiting on all API endpoints
- Helmet security headers (CSP, HSTS, etc.)
- No sensitive data in application logs

### 9. Contact
For any data protection inquiries or to exercise your GDPR rights, contact the application administrator at the email address provided during registration or on the application's homepage.
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
            I have read and accept the Terms of Use and Privacy Notice. I consent to my data being processed as described above, including the sending of my mail images, email content, and attachments to Google Gemini AI for analysis. I understand I can withdraw consent and delete all my data at any time.
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
