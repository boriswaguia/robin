import { createContext, useContext, useState, useEffect } from 'react';
import i18n from '../i18n';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check if a valid session cookie exists
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('No session');
        return res.json();
      })
      .then((userData) => {
        setUser(userData);
        // Sync i18n to the user's stored language preference
        if (userData.language && userData.language !== i18n.language) {
          i18n.changeLanguage(userData.language);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  function login(userData) {
    // Token is stored in an httpOnly cookie by the server — we never touch it
    setUser(userData);
  }

  function updateUser(partial) {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  async function logout() {
    // Ask the server to clear the cookie
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  }

  // Re-prompt if terms version changes (server sets CURRENT_TERMS_VERSION)
  const hasConsented = !!user?.consentedAt && user?.consentVersion === '1.1';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, isAuthenticated: !!user, hasConsented }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

