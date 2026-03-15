import { useState, useEffect, useCallback } from 'react';
import {
  Users, Activity, Search, ChevronLeft, ChevronRight,
  Shield, ShieldOff, Mail, XCircle, Loader2,
  BarChart3, UserPlus, ArrowUpDown,
} from 'lucide-react';

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

// ── Action labels for activity display ───────────────────────────────────────
const ACTION_LABELS = {
  'auth.register': 'Registered',
  'auth.login': 'Logged in',
  'auth.logout': 'Logged out',
  'mail.scan': 'Scanned mail',
  'mail.voice': 'Voice memo',
  'mail.action': 'Took action',
  'mail.delete': 'Deleted mail',
  'gmail.sync': 'Gmail sync',
};

function actionLabel(action) {
  return ACTION_LABELS[action] || action;
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

// ── Stats Overview ───────────────────────────────────────────────────────────
function StatsCards({ stats }) {
  if (!stats) return null;
  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users },
    { label: 'Gmail Connected', value: stats.gmailUsers, icon: Mail },
    { label: 'Total Mail Items', value: stats.totalMail, icon: BarChart3 },
    { label: 'New This Week', value: stats.recentSignups, icon: UserPlus },
  ];
  return (
    <div className="admin-stats">
      {cards.map((c) => (
        <div key={c.label} className="admin-stat-card">
          <c.icon size={20} className="admin-stat-icon" />
          <div className="admin-stat-value">{c.value}</div>
          <div className="admin-stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Pagination ──────────────────────────────────────────────────────────────
function Pagination({ pagination, onPageChange }) {
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
        Page {pagination.page} of {pagination.pages} ({pagination.total} total)
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
          <ChevronLeft size={16} /> Back to users
        </button>
        {detailLoading ? (
          <div className="admin-loading"><Loader2 size={18} className="spin" /> Loading…</div>
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
              <div className="admin-detail-item"><span>Joined</span><strong>{new Date(u.createdAt).toLocaleDateString()}</strong></div>
              <div className="admin-detail-item"><span>Gmail</span><strong>{u.gmailEmail || 'Not connected'}</strong></div>
              <div className="admin-detail-item"><span>Consent</span><strong>{u.consentedAt ? `v${u.consentVersion}` : 'None'}</strong></div>
              <div className="admin-detail-item"><span>Mail Items</span><strong>{u._count.mail}</strong></div>
              <div className="admin-detail-item"><span>Sharing</span><strong>{u._count.sharingFrom + u._count.sharingTo} connections</strong></div>
              <div className="admin-detail-item"><span>Push Devices</span><strong>{u._count.pushSubscriptions}</strong></div>
              <div className="admin-detail-item"><span>Gmail Syncs</span><strong>{u._count.gmailSyncs}</strong></div>
              <div className="admin-detail-item"><span>Activity Logs</span><strong>{u._count.activityLogs}</strong></div>
            </div>

            {userDetail.recentActivity?.length > 0 && (
              <div className="admin-breakdown">
                <h4>Recent Activity</h4>
                <div className="admin-mini-activity">
                  {userDetail.recentActivity.map((a) => (
                    <div key={a.id} className="admin-mini-activity-row">
                      <span className="admin-action-tag">{actionLabel(a.action)}</span>
                      {a.count != null && <span className="text-muted">×{a.count}</span>}
                      <span className="text-muted admin-time">{timeAgo(a.createdAt)}</span>
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
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="admin-search-input"
          />
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="admin-filter-select">
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        <select value={gmailFilter} onChange={(e) => { setGmailFilter(e.target.value); setPage(1); }} className="admin-filter-select">
          <option value="">Gmail: All</option>
          <option value="true">Connected</option>
          <option value="false">Not Connected</option>
        </select>
      </div>

      {error && <div className="error-message"><XCircle size={16} /> {error}</div>}

      {loading ? (
        <div className="admin-loading"><Loader2 size={18} className="spin" /> Loading users…</div>
      ) : users.length === 0 ? (
        <div className="admin-empty">No users found matching your filters.</div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <SortHeader col="name">Name</SortHeader>
                  <SortHeader col="email">Email</SortHeader>
                  <SortHeader col="role">Role</SortHeader>
                  <th>Items</th>
                  <th>Gmail</th>
                  <SortHeader col="createdAt">Joined</SortHeader>
                  <th>Actions</th>
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
                        title={u.role === 'admin' ? 'Remove admin' : 'Make admin'}
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
          <option value="">All Users</option>
          {filteredUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="admin-filter-select"
        >
          <option value="">All Actions</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="admin-filter-date"
          placeholder="From"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="admin-filter-date"
          placeholder="To"
        />
      </div>

      {error && <div className="error-message"><XCircle size={16} /> {error}</div>}

      {loading ? (
        <div className="admin-loading"><Loader2 size={18} className="spin" /> Loading activity…</div>
      ) : logs.length === 0 ? (
        <div className="admin-empty">No activity found matching your filters.</div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>Time</th>
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
                    <td><span className="admin-action-tag">{actionLabel(log.action)}</span></td>
                    <td className="text-muted">
                      {log.count != null && `${log.count} item${log.count !== 1 ? 's' : ''}`}
                      {log.metadata && typeof log.metadata === 'object' && Object.entries(log.metadata).map(([k, v]) => (
                        <span key={k} className="admin-meta-chip">{k}: {String(v)}</span>
                      ))}
                    </td>
                    <td className="text-muted admin-time-cell">
                      <span title={new Date(log.createdAt).toLocaleString()}>{timeAgo(log.createdAt)}</span>
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
  const [tab, setTab] = useState('users');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    apiFetch(`${API}/stats`).then(setStats).catch(() => {});
  }, []);

  return (
    <div className="admin-page">
      <h2 className="admin-title">Admin Panel</h2>

      <StatsCards stats={stats} />

      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'users' ? 'active' : ''}`}
          onClick={() => setTab('users')}
        >
          <Users size={16} /> Users
        </button>
        <button
          className={`admin-tab ${tab === 'activity' ? 'active' : ''}`}
          onClick={() => setTab('activity')}
        >
          <Activity size={16} /> Activity
        </button>
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'activity' && <ActivityTab />}
    </div>
  );
}
