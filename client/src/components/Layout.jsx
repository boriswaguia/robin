import { Link, useLocation } from 'react-router-dom';
import { Mail, ScanLine, Home, LogOut, CalendarDays, BookUser } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">
          <Mail size={28} />
          <span>Robin</span>
        </Link>
        <div className="header-right">
          <span className="user-name">{user?.name}</span>
          <button className="logout-btn" onClick={logout} title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="main">{children}</main>

      <nav className="bottom-nav">
        <Link to="/" className={`nav-item ${pathname === '/' ? 'active' : ''}`}>
          <Home size={22} />
          <span>Dashboard</span>
        </Link>
        <Link to="/scan" className={`nav-item scan-btn ${pathname === '/scan' ? 'active' : ''}`}>
          <ScanLine size={26} />
          <span>Scan</span>
        </Link>
        <Link to="/calendar" className={`nav-item ${pathname === '/calendar' ? 'active' : ''}`}>
          <CalendarDays size={22} />
          <span>Calendar</span>
        </Link>
        <Link to="/directory" className={`nav-item ${pathname.startsWith('/directory') ? 'active' : ''}`}>
          <BookUser size={22} />
          <span>Directory</span>
        </Link>
      </nav>
    </div>
  );
}
