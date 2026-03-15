import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail, ScanLine, Shield, Zap, CalendarDays, BookUser, Brain,
  ArrowRight, CheckCircle, Lock, Eye, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const FEATURE_KEYS = [
  { icon: <ScanLine size={28} />, titleKey: 'landing.featureScanTitle', descKey: 'landing.featureScanDesc' },
  { icon: <Mail size={28} />, titleKey: 'landing.featureGmailTitle', descKey: 'landing.featureGmailDesc' },
  { icon: <Brain size={28} />, titleKey: 'landing.featureAiTitle', descKey: 'landing.featureAiDesc' },
  { icon: <CalendarDays size={28} />, titleKey: 'landing.featureCalendarTitle', descKey: 'landing.featureCalendarDesc' },
  { icon: <BookUser size={28} />, titleKey: 'landing.featureDirectoryTitle', descKey: 'landing.featureDirectoryDesc' },
  { icon: <Lock size={28} />, titleKey: 'landing.featureEncryptionTitle', descKey: 'landing.featureEncryptionDesc' },
];

const FAQ_KEYS = [
  { qKey: 'landing.faq1q', aKey: 'landing.faq1a' },
  { qKey: 'landing.faq2q', aKey: 'landing.faq2a' },
  { qKey: 'landing.faq3q', aKey: 'landing.faq3a' },
  { qKey: 'landing.faq4q', aKey: 'landing.faq4a' },
  { qKey: 'landing.faq5q', aKey: 'landing.faq5a' },
];

export default function LandingPage() {
  const { t } = useTranslation();
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
            <a href="#features">{t('landing.features')}</a>
            <a href="#privacy">{t('landing.privacyNav')}</a>
            <a href="#faq">{t('landing.faq')}</a>
            <Link to="/login" className="btn btn-primary btn-sm">{t('landing.signIn')}</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="hero-glow" />
        <div className="hero-content">
          <div className="hero-badge">
            <Shield size={14} />
            <span>{t('landing.heroBadge')}</span>
          </div>
          <h1>{t('landing.heroTitle1')}<br /><span className="hero-gradient">{t('landing.heroTitle2')}</span></h1>
          <p className="hero-sub">{t('landing.heroSub')}</p>
          <div className="hero-actions">
            <Link to="/login" className="btn btn-primary btn-lg">
              {t('landing.getStarted')} <ArrowRight size={18} />
            </Link>
            <a href="#features" className="btn btn-ghost btn-lg">
              {t('landing.seeHow')}
            </a>
          </div>
          <div className="hero-trust">
            <div className="trust-item"><CheckCircle size={14} /> {t('landing.trustReadOnly')}</div>
            <div className="trust-item"><CheckCircle size={14} /> {t('landing.trustEncryption')}</div>
            <div className="trust-item"><CheckCircle size={14} /> {t('landing.trustDelete')}</div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────── */}
      <section id="features" className="landing-section">
        <h2 className="section-title">{t('landing.featuresTitle')}</h2>
        <p className="section-sub">{t('landing.featuresSub')}</p>
        <div className="features-grid">
          {FEATURE_KEYS.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{t(f.titleKey)}</h3>
              <p>{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it Works ─────────────────────────────── */}
      <section className="landing-section how-section">
        <h2 className="section-title">{t('landing.howTitle')}</h2>
        <div className="how-steps">
          <div className="how-step">
            <div className="step-num">1</div>
            <h3>{t('landing.step1Title')}</h3>
            <p>{t('landing.step1Desc')}</p>
          </div>
          <div className="how-connector" />
          <div className="how-step">
            <div className="step-num">2</div>
            <h3>{t('landing.step2Title')}</h3>
            <p>{t('landing.step2Desc')}</p>
          </div>
          <div className="how-connector" />
          <div className="how-step">
            <div className="step-num">3</div>
            <h3>{t('landing.step3Title')}</h3>
            <p>{t('landing.step3Desc')}</p>
          </div>
        </div>
      </section>

      {/* ── Privacy ──────────────────────────────────── */}
      <section id="privacy" className="landing-section privacy-section">
        <div className="privacy-banner">
          <div className="privacy-banner-icon"><Shield size={32} /></div>
          <div>
            <h2>{t('landing.privacyTitle')}</h2>
            <p>{t('landing.privacySub')}</p>
          </div>
        </div>
        <div className="privacy-grid">
          <div className="privacy-point">
            <Eye size={20} />
            <div>
              <strong>{t('landing.privacyReadOnlyTitle')}</strong>
              <span>{t('landing.privacyReadOnlyDesc')}</span>
            </div>
          </div>
          <div className="privacy-point">
            <Lock size={20} />
            <div>
              <strong>{t('landing.privacyEncryptedTitle')}</strong>
              <span>{t('landing.privacyEncryptedDesc')}</span>
            </div>
          </div>
          <div className="privacy-point">
            <Zap size={20} />
            <div>
              <strong>{t('landing.privacyMinimalTitle')}</strong>
              <span>{t('landing.privacyMinimalDesc')}</span>
            </div>
          </div>
          <div className="privacy-point">
            <Shield size={20} />
            <div>
              <strong>{t('landing.privacyGdprTitle')}</strong>
              <span>{t('landing.privacyGdprDesc')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────── */}
      <section id="faq" className="landing-section">
        <h2 className="section-title">{t('landing.faqTitle')}</h2>
        <div className="faq-list">
          {FAQ_KEYS.map((item, i) => (
            <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
              <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span>{t(item.qKey)}</span>
                {openFaq === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {openFaq === i && <div className="faq-a">{t(item.aKey)}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────── */}
      <section className="landing-cta">
        <h2>{t('landing.ctaTitle')}</h2>
        <p>{t('landing.ctaSub')}</p>
        <Link to="/login" className="btn btn-primary btn-lg">
          {t('landing.ctaButton')} <ArrowRight size={18} />
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
            <Link to="/privacy">{t('landing.footerPrivacy')}</Link>
            <Link to="/terms">{t('landing.footerTerms')}</Link>
            <a href="#faq">{t('landing.faq')}</a>
          </div>
          <p className="footer-copy">{t('landing.footerCopy', { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </div>
  );
}
