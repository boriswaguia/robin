import { Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Scanner from './components/Scanner';
import MailDetail from './components/MailDetail';
import Calendar from './components/Calendar';
import Directory from './components/Directory';
import ContactDetail from './components/ContactDetail';
import AuthPage from './components/AuthPage';

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading…</div>;
  }

  if (!isAuthenticated) {
    return <AuthPage />;
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
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
