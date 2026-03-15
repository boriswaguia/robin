import { useState, useEffect, useCallback } from 'react';
import {
  Users, Activity, Search, ChevronLeft, ChevronRight,
  Shield, ShieldOff, Mail, XCircle, Loader2,
  BarChart3, UserPlus, ArrowUpDown,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const API = '/api/admin';
const OPTS = { credentials: 'include' };

async function apiFetch(url) {
  const res = await fetch(url, OPTS);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Request failed');
  }
  return res.json();
}

async function apiPatch(url, body) {
  const res = await fetch(url, {
    method: 'PATCH',
    ...OPTS,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Request failed');
  }
  return res.json();
}

// ── Action keys for activity display ────────────────────────────────────────
const ACTION_KEYS = {
  'auth.register': 'admin.actionRegistered',
  'auth.login': 'admin.actionLoggedIn',
  'auth.logout': 'admin.actionLoggedOut',
  'mail.scan': 'admin.actionScanned',
  'mail.voice': 'admin.actionVoice',
  'mail.action': 'admin.actionTookAction',
  'mail.delete': 'admin.actionDeleted',
  'gmail.sync': 'admin.actionGmailSync',
};

function actionLabel(action, t) {
  const key = ACTION_KEYS[action];
  return key ? t(key) : action;
}

function timeAgo(date, t) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return t('admin.justNow');
  if (s < 3600) return t('admin.minutesAgo', { count: Math.floor(s / 60) });
  if (s < 86400) return t('admin.hoursAgo', { count: Math.floor(s / 3600) });
  if (s < 604800) return t('admin.daysAgo', { count: Math.floor(s / 86400) });
  return new Date(date).toLocaleDateString();
}

// ── Stats Overview ───────────────────────────────────────────────────────────
function StatsCards({ stats }) {
  const { t } = useTranslation();
  if (!stats) return null;
  const cards = [
    { labelKey: 'admin.totalUsers', value: stats.totalUsers, icon: Users },
    { labelKey: 'admin.gmailConnected', value: stats.gmailUsers, icon: Mail },
    { labelKey: 'admin.totalMail', value: stats.totalMail, icon: BarChart3 },
    { labelKey: 'admin.newThisWeek', value: stats.recentSignups, icon: UserPlus },
  ];
  return (
    <div className="admin-stats">
      {cards.map((c) => (
        <div key={c.labelKey} className="admin-stat-card">
          <c.icon size={20} className="admin-stat-icon" />
          <div className="admin-stat-value">{c.value}</div>
          <div className="admin-stat-label">{t(c.labelKey)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Pagination ──────────────────────────────────────────────────────────────
function Pagination({ pagination, onPageChange }) {
  const { t } = useTranslation();
  if (!pagination || pagination.pages <= 1) return null;
  return (
    <div className="admin-pagination">
      <button
        className="btn btn-ghost btn-sm"
        disabled={pagination.page <= 1}
        onClick={() => onPageChange(pagination.page - 1)}
      >
        <ChevronLeft size={16} />
      </button>
      <span className="admin-pagination-info">
        {t('admin.pageOf', { page: pagination.page, pages: pagination.pages, total: pagination.total })}
      </span>
      <button
        className="btn btn-ghost btn-sm"
        disabled={pagination.page >= pagination.pages}
        onClick={() => onPageChange(pagination.page + 1)}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [gmailFilter, setGmailFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [userDetail, setUserDetail] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (gmailFilter) params.set('hasGmail', gmailFilter);
      params.set('sortBy', sortBy);
      params.set('order', order);
      params.set('page', page);
      const data = await apiFetch(`${API}/users?${params}`);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, gmailFilter, sortBy, order, page]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function loadUserDetail(userId) {
    setSelectedUser(userId);
    setDetailLoading(true);
    try {
      const data = await apiFetch(`${API}/users/${userId}`);
      setUserDetail(data);
    } catch { setUserDetail(null); }
    finally { setDetailLoading(false); }
  }

  async function toggleRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await apiPatch(`${API}/users/${userId}`, { role: newRole });
      loadUsers();
      if (userDetail?.user?.id === userId) {
        setUserDetail((d) => d ? { ...d, user: { ...d.user, role: newRole } } : d);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function handleSort(col) {
    if (sortBy === col) {
      setOrder((o) => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setOrder('desc');
    }
    setPage(1);
  }

  function SortHeader({ col, children }) {
    return (
      <th className="admin-sortable" onClick={() => handleSort(col)}>
        {children}
        {sortBy === col && <ArrowUpDown size={12} className={`sort-icon ${order}`} />}
      </th>
    );
  }

  // User detail drawer
  if (selectedUser && userDetail) {
    const u = userDetail.user;
    return (
      <div className="admin-detail-view">
        <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedUser(null); setUserDetail(null); }}>
          <ChevronLeft size={16} /> {t('admin.backToUsers')}
        </button>
        {detailLoading ? (
          <div className="admin-loading"><Loader2 size={18} className="spin" /> {t('common.loading')}</div>
        ) : (
          <>
            <div className="admin-user-header">
              <div>
                <h3>{u.name}</h3>
                <p className="text-muted">{u.email}</p>
              </div>
              <span className={`admin-role-badge ${u.role}`}>{u.role}</span>
            </div>

            <div className="admin-detail-grid">
              <div className="admin-detail-item"><span>{t('admin.joined')}</span><strong>{new Date(u.createdAt).toLocaleDateString()}</strong></div>
              <div className="admin-detail-item"><span>{t('admin.gmail')}</span><strong>{u.gmailEmail || t('integrations.gmail.disconnected')}</strong></div>
              <div className="admin-detail-item"><span>{t('admin.consent')}</span><strong>{u.consentedAt ? `v${u.consentVersion}` : 'None'}</strong></div>
              <div className="admin-detail-item"><span>{t('admin.sharing')}</span><strong>{u._count.sharingFrom + u._count.sharingTo} {t('admin.connections')}</strong></div>
              <div className="admin-detail-item"><span>{t('admin.pushDevices')}</span><strong>{u._count.pushSubscriptions}</strong></div>
              <div className="admin-detail-item"><span>{t('admin.gmailSyncs')}</span><strong>{u._count.gmailSyncs}</strong></div>
              <div className="admin-detail-item"><span>{t('admin.activityLogs')}</span><strong>{u._count.activityLogs}</strong></div>
            </div>

            {userDetail.recentActivity?.length > 0 && (
              <div className="admin-breakdown">
                <h4>{t('admin.recentActivity')}</h4>
                <div className="admin-mini-activity">
                  {userDetail.recentActivity.map((a) => (
                    <div key={a.id} className="admin-mini-activity-row">
                      <span className="admin-action-tag">{actionLabel(a.action, t)}</span>
                      {a.count != null && <span className="text-muted">×{a.count}</span>}
                      <span className="text-muted admin-time">{timeAgo(a.createdAt, t)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="admin-users-tab">
      {/* Filters */}
      <div className="admin-filters">
        <div className="admin-search-wrap">
          <Search size={16} />
          <input
            type="text"
            placeholder={t('admin.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="admin-search-input"
          />
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="admin-filter-select">
          <option value="">{t('admin.allRoles')}</option>
          <option value="admin">{t('admin.adminRole')}</option>
          <option value="user">{t('admin.userRole')}</option>
        </select>
        <select value={gmailFilter} onChange={(e) => { setGmailFilter(e.target.value); setPage(1); }} className="admin-filter-select">
          <option value="">{t('admin.gmailAll')}</option>
          <option value="true">{t('admin.gmailConnectedFilter')}</option>
          <option value="false">{t('admin.gmailNotConnected')}</option>
        </select>
      </div>

      {error && <div className="error-message"><XCircle size={16} /> {error}</div>}

      {loading ? (
        <div className="admin-loading"><Loader2 size={18} className="spin" /> {t('admin.loadingUsers')}</div>
      ) : users.length === 0 ? (
        <div className="admin-empty">{t('admin.noUsersFound')}</div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <SortHeader col="name">{t('admin.colName')}</SortHeader>
                  <SortHeader col="email">{t('admin.colEmail')}</SortHeader>
                  <SortHeader col="role">{t('admin.colRole')}</SortHeader>
                  <th>Items</th>
                  <th>{t('admin.colGmail')}</th>
                  <SortHeader col="createdAt">{t('admin.joined')}</SortHeader>
                  <th>{t('admin.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="admin-user-row" onClick={() => loadUserDetail(u.id)}>
                    <td className="admin-user-name">{u.name}</td>
                    <td className="text-muted">{u.email}</td>
                    <td><span className={`admin-role-badge ${u.role}`}>{u.role}</span></td>
                    <td>{u._count.mail}</td>
                    <td>{u.gmailEmail ? '✓' : '—'}</td>
                    <td className="text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-ghost btn-sm"
                        title={u.role === 'admin' ? t('admin.removeAdmin') : t('admin.makeAdmin')}
                        onClick={() => toggleRole(u.id, u.role)}
                      >
                        {u.role === 'admin' ? <ShieldOff size={16} /> : <Shield size={16} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

// ── Activity Tab ─────────────────────────────────────────────────────────────
function ActivityTab() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFilter, setActionFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Fetch all users for the user filter dropdown
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    apiFetch(`${API}/users?limit=100`).then((d) => setAllUsers(d.users || [])).catch(() => {});
  }, []);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedUserId) params.set('userId', selectedUserId);
      if (actionFilter) params.set('action', actionFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      params.set('page', page);
      const data = await apiFetch(`${API}/activity?${params}`);
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedUserId, actionFilter, dateFrom, dateTo, page]);

  useEffect(() => { loadActivity(); }, [loadActivity]);

  // Filter allUsers by search text for the dropdown
  const filteredUsers = userSearch
    ? allUsers.filter((u) =>
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase())
      )
    : allUsers;

  return (
    <div className="admin-activity-tab">
      {/* Filters */}
      <div className="admin-filters">
        <select
          value={selectedUserId}
          onChange={(e) => { setSelectedUserId(e.target.value); setPage(1); }}
          className="admin-filter-select"
        >
          <option value="">{t('admin.allUsers')}</option>
          {filteredUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="admin-filter-select"
        >
          <option value="">{t('admin.allActions')}</option>
          {Object.entries(ACTION_KEYS).map(([k, v]) => (
            <option key={k} value={k}>{t(v)}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="admin-filter-date"
          placeholder={t('admin.from')}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="admin-filter-date"
          placeholder={t('admin.to')}
        />
      </div>

      {error && <div className="error-message"><XCircle size={16} /> {error}</div>}

      {loading ? (
        <div className="admin-loading"><Loader2 size={18} className="spin" /> {t('admin.loadingActivity')}</div>
      ) : logs.length === 0 ? (
        <div className="admin-empty">{t('admin.noActivity')}</div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.colUser')}</th>
                  <th>{t('admin.colAction')}</th>
                  <th>{t('admin.colDetails')}</th>
                  <th>{t('admin.colTime')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="admin-user-cell">
                        <span className="admin-user-name">{log.user.name}</span>
                        <span className="text-muted admin-user-email">{log.user.email}</span>
                      </div>
                    </td>
                    <td><span className="admin-action-tag">{actionLabel(log.action, t)}</span></td>
                    <td className="text-muted">
                      {log.count != null && `${log.count} item${log.count !== 1 ? 's' : ''}`}
                      {log.metadata && typeof log.metadata === 'object' && Object.entries(log.metadata).map(([k, v]) => (
                        <span key={k} className="admin-meta-chip">{k}: {String(v)}</span>
                      ))}
                    </td>
                    <td className="text-muted admin-time-cell">
                      <span title={new Date(log.createdAt).toLocaleString()}>{timeAgo(log.createdAt, t)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

// ── Main Admin Panel ─────────────────────────────────────────────────────────
export default function AdminPanel() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('users');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    apiFetch(`${API}/stats`).then(setStats).catch(() => {});
  }, []);

  return (
    <div className="admin-page">
      <h2 className="admin-title">{t('admin.title')}</h2>

      <StatsCards stats={stats} />

      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'users' ? 'active' : ''}`}
          onClick={() => setTab('users')}
        >
          <Users size={16} /> {t('admin.tabUsers')}
        </button>
        <button
          className={`admin-tab ${tab === 'activity' ? 'active' : ''}`}
          onClick={() => setTab('activity')}
        >
          <Activity size={16} /> {t('admin.tabActivity')}
        </button>
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'activity' && <ActivityTab />}
    </div>
  );
}
