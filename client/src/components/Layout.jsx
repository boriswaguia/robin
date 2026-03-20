import { Link, useLocation } from 'react-router-dom';
import { Mail, ScanLine, Home, LogOut, CalendarDays, BookUser, Settings, ClipboardList, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function Layout({ children }) {
  const { pathname, state } = useLocation();
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  // When inside a detail page (/mail/:id), highlight the tab we came from
  const fromPath = state?.from;
  function navActive(path) {
    if (path === '/directory') return pathname.startsWith('/directory');
    if (pathname === path) return true;
    if (pathname.startsWith('/mail/')) {
      // Highlight the originating tab; default to Home
      return fromPath ? fromPath === path : path === '/';
    }
    return false;
  }

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">
          <Mail size={28} />
          <span>Robin</span>
        </Link>
        <div className="header-right">
          <span className="user-name">{user?.name}</span>
          {user?.role === 'admin' && (
            <Link to="/admin" className="header-icon-btn" title={t('layout.adminPanel')}>
              <ShieldCheck size={18} />
            </Link>
          )}
          <Link to="/integrations" className="header-icon-btn" title={t('layout.integrations')}>
            <Settings size={18} />
          </Link>
          <button className="logout-btn" onClick={logout} title={t('layout.signOut')}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="main">{children}</main>

      <nav className="bottom-nav">
        <Link to="/" className={`nav-item ${navActive('/') ? 'active' : ''}`}>
          <Home size={22} />
          <span>{t('layout.home')}</span>
        </Link>
        <Link to="/agenda" className={`nav-item ${navActive('/agenda') ? 'active' : ''}`}>
          <ClipboardList size={22} />
          <span>{t('layout.agenda')}</span>
        </Link>
        <Link to="/scan" className={`nav-item scan-btn ${pathname === '/scan' ? 'active' : ''}`}>
          <ScanLine size={26} />
          <span>{t('layout.scan')}</span>
        </Link>
        <Link to="/calendar" className={`nav-item ${navActive('/calendar') ? 'active' : ''}`}>
          <CalendarDays size={22} />
          <span>{t('layout.calendar')}</span>
        </Link>
        <Link to="/directory" className={`nav-item ${navActive('/directory') ? 'active' : ''}`}>
          <BookUser size={22} />
          <span>{t('layout.directory')}</span>
        </Link>
      </nav>
    </div>
  );
}
