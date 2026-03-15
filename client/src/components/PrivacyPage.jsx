import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Shield } from 'lucide-react';

const PRIVACY_CONTENT = `
## Privacy Policy
**Version 1.1 — Last updated: March 2026**

### 1. Introduction
Robin ("the App") is a personal mail scanning and management tool. This Privacy Policy explains how we collect, use, and protect your personal data in accordance with the EU General Data Protection Regulation (GDPR / DSGVO).

### 2. Data Controller
The data controller is the individual or organization operating this self-hosted instance of Robin. Contact details are available from your instance administrator.

### 3. What Data We Collect

**Account data:**
- Name, email address, and a securely hashed password (bcrypt, cost factor 12)

**Mail data (scanned documents):**
- Images of scanned postal mail
- AI-extracted text, summaries, categories, urgency assessments
- Extracted details: due dates, amounts, IBANs, reference numbers, addresses

**Gmail data (if you connect Gmail):**
- Email subject lines, sender information, and body text (up to 8,000 characters) for actionable emails only
- PDF and image attachments from actionable emails
- OAuth tokens (access and refresh tokens) — encrypted at rest
- Connected Gmail address

**Sharing data:**
- Connections between users (sharing invites, accepted connections)
- Per-item share records

### 4. How We Use Your Data

Your data is used solely to provide the Robin service:
- Analyze mail and email content to extract structured, actionable information
- Categorize and prioritize your correspondence
- Set reminders for upcoming due dates
- Enable sharing of mail items between connected users

### 5. Gmail Integration — Specific Processing

If you connect Gmail, the following processing occurs:
- **Tier 1 (local):** Newsletters, promotions, social, and forum emails are skipped based on email headers and Gmail labels. No data leaves the server.
- **Tier 2 (AI pre-filter):** Subject, sender, and a brief snippet are sent to Google Gemini to determine if an email requires action.
- **Tier 3 (full analysis):** For actionable emails only, the full body and attachments are sent to Google Gemini for detailed analysis.

Robin requests only two Gmail permissions:
- \`gmail.readonly\` — read-only access (Robin cannot send, modify, or delete emails)
- \`userinfo.email\` — to identify the connected Gmail account

### 6. Third-Party Data Sharing

- **Google Gemini API:** Mail images, document scans, and email text are sent to Google's Gemini AI for analysis. Google's [Privacy Policy](https://policies.google.com/privacy) and Data Processing Terms apply.
- **No other third parties** receive your data. We do not sell, share, or transfer data to advertisers, data brokers, or any other entity.

### 7. Data Security

- AES-256-GCM encryption at rest for all sensitive fields (extracted text, summaries, financial details, OAuth tokens)
- File-level encryption for uploaded documents on disk
- bcrypt password hashing (cost factor 12)
- httpOnly, Secure, SameSite=Strict session cookies
- Rate limiting on all API endpoints
- Helmet security headers (CSP, HSTS, X-Frame-Options)
- No sensitive data in application logs

### 8. Automated Decision-Making (Article 22 GDPR)

Robin uses automated processing (AI) to categorize mail, assess urgency, extract details, and filter Gmail. These are assistive suggestions only — you can edit any analysis and override any automated decision. No legally binding decisions are made solely by automated processing.

### 9. Your Rights (GDPR Articles 15–22)

You have the right to:
- **Access** — export all your personal data as JSON
- **Rectify** — edit any AI-generated analysis directly
- **Erase** — permanently delete your account and all data
- **Restrict processing** — disconnect Gmail, stop scanning, delete items
- **Data portability** — export in machine-readable JSON format
- **Object** — disconnect integrations or delete your account
- **Withdraw consent** — delete your account at any time (immediate, irreversible)

### 10. Data Retention

- Data is retained only while your account exists
- Account deletion removes all mail, images, tokens, and connections permanently
- Gmail tokens are deleted immediately when you disconnect Gmail
- No backups of user data are retained after deletion

### 11. International Data Transfers

Data may be transferred to Google servers (Gemini API) which may be located outside the EEA. Google provides appropriate safeguards including Standard Contractual Clauses (SCCs).

### 12. Cookies

Robin uses a single essential cookie:
- **robin_session** — an httpOnly, Secure, SameSite=Strict session cookie for authentication (7-day expiry)

No analytics, tracking, or third-party cookies are used.

### 13. Changes to This Policy

We may update this policy from time to time. The version number and date at the top will be updated. If we make material changes, existing users will be asked to re-accept the updated terms.

### 14. Contact

For data protection inquiries or to exercise your GDPR rights, contact the application administrator.
`;

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <Link to="/" className="legal-back">
          <ArrowLeft size={18} />
          <Mail size={20} />
          <span>Robin</span>
        </Link>
      </nav>
      <div className="legal-content">
        <div className="legal-icon"><Shield size={28} /></div>
        <div
          className="legal-text consent-text"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(PRIVACY_CONTENT) }}
        />
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <Link to="/" className="legal-back">
          <ArrowLeft size={18} />
          <Mail size={20} />
          <span>Robin</span>
        </Link>
      </nav>
      <div className="legal-content">
        <div className="legal-icon"><Shield size={28} /></div>
        <div
          className="legal-text consent-text"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(TERMS_CONTENT) }}
        />
      </div>
    </div>
  );
}

const TERMS_CONTENT = `
## Terms of Use
**Version 1.1 — Last updated: March 2026**

### 1. Service Description
Robin is a personal mail scanning and management tool. It uses AI (Google Gemini) to analyze images of your mail and email content to extract structured information.

### 2. Acceptance
By creating an account and using Robin, you agree to these Terms of Use and the Privacy Policy.

### 3. Disclaimer of Liability
THE APP IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. THE DEVELOPER(S) AND OPERATOR(S):
- Take no ownership or responsibility for any damage, loss, or liability arising from the use of this application
- Are not liable for inaccuracies or errors in AI-generated analysis
- Are not liable for financial, legal, or personal consequences resulting from actions taken based on information provided by the App
- Do not guarantee availability, reliability, or accuracy of the service
- Are not responsible for data loss or security breaches, though reasonable security measures are implemented

You use this application entirely at your own risk.

### 4. User Responsibilities
- You are responsible for the accuracy of information you provide
- You must not use Robin to process documents you are not authorized to access
- You must keep your account credentials secure

### 5. Data Processing
Your data is processed as described in our Privacy Policy. By using Robin, you consent to this processing.

### 6. Account Termination
You may delete your account at any time. All data will be immediately and permanently removed.

### 7. Governing Law
These terms are governed by the laws of the European Union and the applicable member state of the data controller.

### 8. Contact
For questions about these terms, contact the application administrator.
`;

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
    .replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');
}

function inlineMd(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
