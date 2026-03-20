import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, ScanLine, ChevronRight, AlertTriangle, Search, X, Bell, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { getAllMail, getDueReminders, getSharedWithMe } from '../services/api';
import { useTranslation } from 'react-i18next';
import MailCard from './MailCard';

export default function Dashboard() {
  const { t } = useTranslation();
  const [mail, setMail] = useState([]);          // all mail (source of truth)
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showSearch, setShowSearch] = useState(false);
  const [searchParams, setSearchParams] = useState({ q: '', sender: '', receiver: '', dateFrom: '', dateTo: '' });
  const [reminders, setReminders] = useState([]);
  const [dismissedReminders, setDismissedReminders] = useState(new Set());
  const [sharedMail, setSharedMail] = useState([]);
  const [sharedExpanded, setSharedExpanded] = useState(true);

  const fetchMail = useCallback(() => {
    return getAllMail()
      .then((items) => setMail(items))
      .catch(() => setMail([]));
  }, []);

  // Fetch mail, and auto-refresh every 3 seconds while any item is still processing
  useEffect(() => {
    let mailInterval;

    function poll() {
      fetchMail()
        .finally(() => setLoading(false));
    }

    poll();

    // Poll mail every 3s only while something is still processing
    mailInterval = setInterval(() => {
      setMail((prev) => {
        if (prev.some((m) => m.status === 'processing')) fetchMail();
        return prev;
      });
    }, 3000);

    // Load shared mail once on mount
    getSharedWithMe().then(setSharedMail).catch(() => {});

    return () => clearInterval(mailInterval);
  }, [fetchMail]);

  // Only poll for due reminders when at least one mail item actually has a reminder set
  const hasPendingReminders = mail.some((m) => m.reminderAt && !m.reminderSent);

  useEffect(() => {
    if (!hasPendingReminders) return;
    getDueReminders().then(setReminders).catch(() => {});
    const reminderInterval = setInterval(() => {
      getDueReminders().then(setReminders).catch(() => {});
    }, 60_000);
    return () => clearInterval(reminderInterval);
  }, [hasPendingReminders]);

  async function handleSearch(e) {
    e.preventDefault();
    // No-op — filtering is now live via searchParams
  }

  function clearSearch() {
    setSearchParams({ q: '', sender: '', receiver: '', dateFrom: '', dateTo: '' });
    setShowSearch(false);
  }

  // Client-side search filtering (fields are already decrypted in memory)
  const isSearchActive = Object.values(searchParams).some((v) => v);

  function matchesSearch(m) {
    const { q, sender, receiver, dateFrom, dateTo } = searchParams;
    if (q) {
      const lower = q.toLowerCase();
      const match = (m.sender && m.sender.toLowerCase().includes(lower)) ||
                    (m.receiver && m.receiver.toLowerCase().includes(lower)) ||
                    (m.summary && m.summary.toLowerCase().includes(lower));
      if (!match) return false;
    }
    if (sender && !(m.sender && m.sender.toLowerCase().includes(sender.toLowerCase()))) return false;
    if (receiver && !(m.receiver && m.receiver.toLowerCase().includes(receiver.toLowerCase()))) return false;
    if (dateFrom && m.createdAt < dateFrom) return false;
    if (dateTo && m.createdAt > dateTo + 'T23:59:59.999Z') return false;
    return true;
  }

  // Items that genuinely need user attention (new + has suggested actions, excluding errors)
  const actionNeeded = mail.filter((m) => m.status === 'new' && m.suggestedActions?.length > 0);
  const newCount = actionNeeded.length;

  // Priority sort: processing → needs-action (urgent first) → new/info → done → error/rejected
  function prioritySort(a, b) {
    function score(m) {
      if (m.status === 'processing') return -1; // always on top
      if (m.status === 'error' || m.status === 'rejected') return 5;
      if (m.status !== 'new') return 4; // action already taken
      if (!m.suggestedActions?.length) return 3; // informational
      if (m.urgency === 'high') return 0;
      if (m.urgency === 'medium') return 1;
      return 2; // low urgency but needs action
    }
    const diff = score(a) - score(b);
    if (diff !== 0) return diff;
    // Within same priority: sort by dueDate ascending (soonest first), then by createdAt descending
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1; // items with due dates come first
    if (b.dueDate) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt); // newest first if no due dates
  }

  const filtered = (filter === 'all'
    ? mail
    : mail.filter((m) => m.category === filter)
  ).filter((m) => !isSearchActive || matchesSearch(m))
   .slice().sort(prioritySort);

  if (loading) {
    return <div className="loading">{t('dashboard.loadingMail')}</div>;
  }

  return (
    <div className="dashboard">
      {reminders.filter((r) => !dismissedReminders.has(r.id)).length > 0 && (
        <div className="reminders-banner">
          <div className="reminders-title"><Bell size={16} /> {t('dashboard.reminders')}</div>
          {reminders.filter((r) => !dismissedReminders.has(r.id)).map((r) => (
            <Link to={`/mail/${r.id}`} key={r.id} className="reminder-item">
              <div className="reminder-content">
                <strong>{r.sender || t('dashboard.mail')}</strong>
                <span>{r.summary || t('dashboard.reminderDue')}</span>
                {r.dueDate && <span className="reminder-due">{t('dashboard.duePrefix')}{new Date(r.dueDate).toLocaleDateString()}</span>}
              </div>
              <button className="reminder-dismiss" onClick={(e) => { e.preventDefault(); setDismissedReminders((prev) => new Set([...prev, r.id])); }}>
                <X size={14} />
              </button>
            </Link>
          ))}
        </div>
      )}

      {mail.length > 0 && (
        <div className="stats-row">
          <div className={`stat-card${newCount > 0 ? ' urgent' : ''}`}>
            <Inbox size={20} />
            <div>
              <span className="stat-number">{newCount}</span>
              <span className="stat-label">{t('dashboard.actionNeeded')}</span>
            </div>
          </div>
          <div className="stat-card">
            <Inbox size={20} />
            <div>
              <span className="stat-number">{mail.length}</span>
              <span className="stat-label">{t('dashboard.total')}</span>
            </div>
          </div>
          <button className="stat-card search-toggle" onClick={() => setShowSearch(!showSearch)}>
            <Search size={20} />
            <div>
              <span className="stat-label">{t('dashboard.search')}</span>
            </div>
          </button>
        </div>
      )}

      {showSearch && (
        <div className="search-bar">
          <div className="search-row">
            <Search size={16} />
            <input
              type="text"
              placeholder={t('dashboard.searchPlaceholder')}
              value={searchParams.q}
              onChange={(e) => setSearchParams({ ...searchParams, q: e.target.value })}
              autoFocus
            />
            <button type="button" className="search-clear" onClick={clearSearch} title={t('dashboard.clearSearch')}>
              <X size={16} />
            </button>
          </div>
          <div className="search-filters">
            <input
              type="text"
              placeholder={t('dashboard.sender')}
              value={searchParams.sender}
              onChange={(e) => setSearchParams({ ...searchParams, sender: e.target.value })}
            />
            <input
              type="text"
              placeholder={t('dashboard.receiver')}
              value={searchParams.receiver}
              onChange={(e) => setSearchParams({ ...searchParams, receiver: e.target.value })}
            />
            <input
              type="date"
              value={searchParams.dateFrom}
              onChange={(e) => setSearchParams({ ...searchParams, dateFrom: e.target.value })}
              title={t('dashboard.fromDate')}
            />
            <input
              type="date"
              value={searchParams.dateTo}
              onChange={(e) => setSearchParams({ ...searchParams, dateTo: e.target.value })}
              title={t('dashboard.toDate')}
            />
          </div>
        </div>
      )}

      {mail.length > 0 && (
        <div className="filter-bar">
          {[['all', t('dashboard.filterAll')], ['bill', t('dashboard.filterBill')], ['personal', t('dashboard.filterPersonal')], ['government', t('dashboard.filterGovernment')], ['financial', t('dashboard.filterFinancial')], ['medical', t('dashboard.filterMedical')], ['delivery', t('dashboard.filterDelivery')], ['reminder', t('dashboard.filterReminder')]].map(([f, label]) => (
            <button
              key={f}
              className={`filter-chip ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mail.length === 0 ? (
        <div className="empty-state">
          <Inbox size={64} strokeWidth={1} />
          <h3>{t('dashboard.noMailTitle')}</h3>
          <p>{t('dashboard.noMailDesc')}</p>
          <Link to="/scan" className="btn btn-primary">
            <ScanLine size={20} />
            <span>{t('dashboard.scanMail')}</span>
          </Link>
        </div>
      ) : (
        <div className="mail-list">
          {filtered.map((item) => (
            <Link to={`/mail/${item.id}`} key={item.id} className="mail-link" state={{ from: '/' }}>
              <MailCard item={item} />
              <ChevronRight size={18} className="chevron" />
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="no-results">{t('dashboard.noResults')}</p>
          )}
        </div>
      )}

      {/* Shared with me */}
      {sharedMail.length > 0 && (
        <div className="shared-section">
          <button className="shared-section-header" onClick={() => setSharedExpanded((v) => !v)}>
            <Users size={16} />
            <span>{t('dashboard.sharedWithYou')} ({sharedMail.length})</span>
            {sharedExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {sharedExpanded && (
            <div className="mail-list">
              {sharedMail.map((item) => (
                <Link to={`/mail/${item.id}`} key={item.id} className="mail-link" state={{ from: '/' }}>
                  <MailCard item={item} sharedBy={item.sharedBy} />
                  <ChevronRight size={18} className="chevron" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
