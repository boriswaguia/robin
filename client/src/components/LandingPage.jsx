import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail, ScanLine, Shield, Zap, CalendarDays, BookUser, Brain,
  ArrowRight, CheckCircle, Lock, Eye, ChevronDown, ChevronUp,
} from 'lucide-react';

const FEATURES = [
  {
    icon: <ScanLine size={28} />,
    title: 'Scan & Understand',
    desc: 'Snap a photo of any letter, bill, or notice. Robin reads it, extracts due dates, amounts, IBANs, and tells you exactly what to do.',
  },
  {
    icon: <Mail size={28} />,
    title: 'Gmail Sync',
    desc: 'Connect your inbox and Robin automatically finds actionable emails — bills, appointments, legal notices — and pulls them in. Read-only, no email is ever sent.',
  },
  {
    icon: <Brain size={28} />,
    title: 'AI-Powered Analysis',
    desc: 'Powered by Google Gemini. Every document is categorised, prioritised, and key details are extracted so you never miss a deadline.',
  },
  {
    icon: <CalendarDays size={28} />,
    title: 'Calendar & Reminders',
    desc: 'Due dates land on your calendar automatically. Get reminded 2 days before a bill is due or an appointment arrives.',
  },
  {
    icon: <BookUser size={28} />,
    title: 'Contact Directory',
    desc: 'Robin builds a directory of every sender and receiver — your utility company, doctor, tax office — and groups their mail together.',
  },
  {
    icon: <Lock size={28} />,
    title: 'Encrypted & Private',
    desc: 'AES-256-GCM encryption at rest. Your documents, extracted data, and tokens are encrypted on disk and in the database. No data is sold or shared.',
  },
];

const FAQ = [
  {
    q: 'What data does Robin access from my Gmail?',
    a: 'Robin requests read-only access to your Gmail inbox. It scans the last 7 days for actionable emails (bills, appointments, legal notices). Newsletters, promotions, and social emails are automatically skipped. Robin cannot send, modify, or delete your emails.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Your data is stored on the Robin server with AES-256-GCM encryption at rest. Mail images, extracted text, financial information, and OAuth tokens are all encrypted. Passwords are hashed with bcrypt.',
  },
  {
    q: 'Can I delete all my data?',
    a: 'Yes. You can export all your data as JSON at any time, and permanently delete your account with one click. Deletion is immediate and irreversible — all mail, images, tokens, and connections are removed.',
  },
  {
    q: 'Is Robin GDPR / DSGVO compliant?',
    a: 'Yes. Robin collects only the data necessary to provide the service, processes it with your explicit consent, and gives you full control (access, rectify, erase, export, object). No data is shared with third parties except Google Gemini for AI analysis.',
  },
  {
    q: 'Is Robin free?',
    a: 'Robin is a self-hosted open-source tool. You run it yourself. The only external cost is the Google Gemini API, which has a generous free tier that covers personal use.',
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="landing">
      {/* ── Navigation ───────────────────────────────── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <Mail size={26} />
            <span>Robin</span>
          </div>
          <div className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#privacy">Privacy</a>
            <a href="#faq">FAQ</a>
            <Link to="/login" className="btn btn-primary btn-sm">Sign In</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="hero-glow" />
        <div className="hero-content">
          <div className="hero-badge">
            <Shield size={14} />
            <span>GDPR compliant · Encrypted · Open Source</span>
          </div>
          <h1>Your mail,<br /><span className="hero-gradient">understood.</span></h1>
          <p className="hero-sub">
            Robin scans your postal mail and email, extracts what matters — due dates, amounts, IBANs, appointments — and tells you exactly what to do. No more paper piles.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="btn btn-primary btn-lg">
              Get Started <ArrowRight size={18} />
            </Link>
            <a href="#features" className="btn btn-ghost btn-lg">
              See How It Works
            </a>
          </div>
          <div className="hero-trust">
            <div className="trust-item"><CheckCircle size={14} /> Read-only Gmail access</div>
            <div className="trust-item"><CheckCircle size={14} /> AES-256 encryption</div>
            <div className="trust-item"><CheckCircle size={14} /> Delete anytime</div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────── */}
      <section id="features" className="landing-section">
        <h2 className="section-title">Everything you need to stay on top of your mail</h2>
        <p className="section-sub">Scan paper mail, sync Gmail, and let AI do the heavy lifting.</p>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it Works ─────────────────────────────── */}
      <section className="landing-section how-section">
        <h2 className="section-title">How it works</h2>
        <div className="how-steps">
          <div className="how-step">
            <div className="step-num">1</div>
            <h3>Scan or Sync</h3>
            <p>Take a photo of a letter or connect your Gmail. Robin handles both.</p>
          </div>
          <div className="how-connector" />
          <div className="how-step">
            <div className="step-num">2</div>
            <h3>AI Analysis</h3>
            <p>Gemini reads every word, extracts due dates, amounts, reference numbers, and categorises it.</p>
          </div>
          <div className="how-connector" />
          <div className="how-step">
            <div className="step-num">3</div>
            <h3>Act & Archive</h3>
            <p>See exactly what needs your attention. Pay, reply, schedule — then archive with one tap.</p>
          </div>
        </div>
      </section>

      {/* ── Privacy ──────────────────────────────────── */}
      <section id="privacy" className="landing-section privacy-section">
        <div className="privacy-banner">
          <div className="privacy-banner-icon"><Shield size={32} /></div>
          <div>
            <h2>Privacy-first by design</h2>
            <p>Robin is built for people who take their data seriously.</p>
          </div>
        </div>
        <div className="privacy-grid">
          <div className="privacy-point">
            <Eye size={20} />
            <div>
              <strong>Read-only access</strong>
              <span>Robin cannot send, modify, or delete your emails. Gmail scope is strictly read-only.</span>
            </div>
          </div>
          <div className="privacy-point">
            <Lock size={20} />
            <div>
              <strong>Encrypted at rest</strong>
              <span>All personal data, documents, tokens, and extracted details are encrypted with AES-256-GCM.</span>
            </div>
          </div>
          <div className="privacy-point">
            <Zap size={20} />
            <div>
              <strong>Minimal data</strong>
              <span>Only actionable emails are stored. Newsletters, promos, and social emails are skipped and never saved.</span>
            </div>
          </div>
          <div className="privacy-point">
            <Shield size={20} />
            <div>
              <strong>Full GDPR rights</strong>
              <span>Export, rectify, or permanently delete all your data at any time. Your data, your rules.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────── */}
      <section id="faq" className="landing-section">
        <h2 className="section-title">Frequently asked questions</h2>
        <div className="faq-list">
          {FAQ.map((item, i) => (
            <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
              <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span>{item.q}</span>
                {openFaq === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {openFaq === i && <div className="faq-a">{item.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────── */}
      <section className="landing-cta">
        <h2>Ready to take control of your mail?</h2>
        <p>Free, private, and open source. Start in under a minute.</p>
        <Link to="/login" className="btn btn-primary btn-lg">
          Create Your Account <ArrowRight size={18} />
        </Link>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Mail size={20} />
            <span>Robin</span>
          </div>
          <div className="footer-links">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Use</Link>
            <a href="#faq">FAQ</a>
          </div>
          <p className="footer-copy">© {new Date().getFullYear()} Robin. Open source. Self-hosted.</p>
        </div>
      </footer>
    </div>
  );
}
