import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Scanner from './components/Scanner';
import MailDetail from './components/MailDetail';
import Calendar from './components/Calendar';
import Directory from './components/Directory';
import ContactDetail from './components/ContactDetail';
import AuthPage from './components/AuthPage';
import Integrations from './components/Integrations';
import ConsentScreen from './components/ConsentScreen';
import LandingPage from './components/LandingPage';
import CookieConsent from './components/CookieConsent';
import PrivacyPage, { TermsPage } from './components/PrivacyPage';

function NotFound() {
  return (
    <div className="empty-state">
      <h3>Page not found</h3>
      <p>The page you're looking for doesn't exist.</p>
      <a href="/" className="btn btn-primary">Go to Dashboard</a>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, hasConsented, updateUser, loading } = useAuth();
  const { pathname } = useLocation();

  // Public routes — always accessible regardless of auth state
  const publicRoutes = ['/privacy', '/terms'];
  if (publicRoutes.includes(pathname)) {
    return (
      <Routes>
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Routes>
    );
  }

  if (loading) {
    return <div className="loading">Loading…</div>;
  }

  if (!isAuthenticated) {
    // Show landing page on root, AuthPage on /login
    if (pathname === '/login' || pathname === '/register') {
      return <AuthPage />;
    }
    return <LandingPage />;
  }

  if (!hasConsented) {
    return <ConsentScreen onConsent={(userData) => updateUser(userData)} />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/scan" element={<Scanner />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/directory/:name" element={<ContactDetail />} />
        <Route path="/mail/:id" element={<MailDetail />} />
        <Route path="/integrations" element={<Integrations />} />
        {/* Redirect auth pages to dashboard when already logged in */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <CookieConsent />
    </AuthProvider>
  );
}
