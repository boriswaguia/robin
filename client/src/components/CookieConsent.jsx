import { useState, useEffect } from 'react';
import { Cookie, X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const COOKIE_CONSENT_KEY = 'robin_cookie_consent';

/**
 * Elegant, non-intrusive cookie consent banner.
 * Slides up from the bottom. Remembers choice in localStorage.
 * Shows on every public/authenticated page until accepted.
 */
export default function CookieConsent() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  function accept() {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      accepted: true,
      timestamp: new Date().toISOString(),
      essential: true,
    }));
    dismiss();
  }

  function dismiss() {
    setAnimating(true);
    setTimeout(() => setVisible(false), 350);
  }

  if (!visible) return null;

  return (
    <div className={`cookie-banner ${animating ? 'cookie-banner-exit' : 'cookie-banner-enter'}`}>
      <div className="cookie-banner-inner">
        <div className="cookie-banner-icon">
          <Cookie size={22} />
        </div>
        <div className="cookie-banner-text">
          <p>
            <strong>{t('cookie.essentialOnly')}</strong> {t('cookie.description')}
          </p>
          <p className="cookie-banner-detail">
            {t('cookie.detail')}
          </p>
        </div>
        <div className="cookie-banner-actions">
          <button className="btn btn-primary btn-sm cookie-accept-btn" onClick={accept}>
            {t('cookie.gotIt')}
          </button>
          <button className="cookie-close-btn" onClick={accept} title={t('cookie.dismiss')}>
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
