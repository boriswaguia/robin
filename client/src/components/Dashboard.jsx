import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, ScanLine, ChevronRight, AlertTriangle, Search, X, Bell, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { getAllMail, searchMail, getDueReminders, getSharedWithMe } from '../services/api';
import MailCard from './MailCard';

export default function Dashboard() {
  const [mail, setMail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(null); // null = auto-pick on first load
  const [showSearch, setShowSearch] = useState(false);
  const [searchParams, setSearchParams] = useState({ q: '', sender: '', receiver: '', dateFrom: '', dateTo: '' });
  const [isSearching, setIsSearching] = useState(false);
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
    setIsSearching(true);
    try {
      const results = await searchMail(searchParams);
      setMail(results);
    } catch { /* ignore */ }
    setIsSearching(false);
  }

  function clearSearch() {
    setSearchParams({ q: '', sender: '', receiver: '', dateFrom: '', dateTo: '' });
    setShowSearch(false);
    setLoading(true);
    fetchMail().finally(() => setLoading(false));
  }

  // Items that genuinely need user attention (new + has suggested actions, excluding errors)
  const actionNeeded = mail.filter((m) => m.status === 'new' && m.suggestedActions?.length > 0);
  const newCount = actionNeeded.length;
  const urgentCount = actionNeeded.filter((m) => m.urgency === 'high').length;

  // Auto-pick default filter on first load
  const activeFilter = filter ?? (newCount > 0 ? 'action_needed' : 'all');

  // Priority sort: urgent action-needed → action-needed → new/info → done → error/rejected
  function prioritySort(a, b) {
    function score(m) {
      if (m.status === 'error' || m.status === 'rejected') return 5;
      if (m.status !== 'new') return 4; // action already taken
      if (!m.suggestedActions?.length) return 3; // informational
      if (m.urgency === 'high') return 0;
      if (m.urgency === 'medium') return 1;
      return 2; // low urgency but needs action
    }
    const diff = score(a) - score(b);
    if (diff !== 0) return diff;
    return new Date(b.createdAt) - new Date(a.createdAt); // newest first within same priority
  }

  const filtered = (activeFilter === 'all'
    ? mail
    : activeFilter === 'action_needed'
      ? mail.filter((m) => m.status === 'new' && m.suggestedActions?.length > 0)
      : mail.filter((m) => m.category === activeFilter)
  ).slice().sort(prioritySort);

  if (loading) {
    return <div className="loading">Loading your mail…</div>;
  }

  return (
    <div className="dashboard">
      {reminders.filter((r) => !dismissedReminders.has(r.id)).length > 0 && (
        <div className="reminders-banner">
          <div className="reminders-title"><Bell size={16} /> Reminders</div>
          {reminders.filter((r) => !dismissedReminders.has(r.id)).map((r) => (
            <Link to={`/mail/${r.id}`} key={r.id} className="reminder-item">
              <div className="reminder-content">
                <strong>{r.sender || 'Mail'}</strong>
                <span>{r.summary || 'Reminder due'}</span>
                {r.dueDate && <span className="reminder-due">Due: {new Date(r.dueDate).toLocaleDateString()}</span>}
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
          <button className={`stat-card ${activeFilter === 'action_needed' ? 'active' : ''}`} onClick={() => setFilter(activeFilter === 'action_needed' ? 'all' : 'action_needed')}>
            <Inbox size={20} />
            <div>
              <span className="stat-number">{newCount}</span>
              <span className="stat-label">Needs Action</span>
            </div>
          </button>
          {urgentCount > 0 && (
            <div className="stat-card urgent">
              <AlertTriangle size={20} />
              <div>
                <span className="stat-number">{urgentCount}</span>
                <span className="stat-label">Urgent</span>
              </div>
            </div>
          )}
          <button className="stat-card search-toggle" onClick={() => setShowSearch(!showSearch)}>
            <Search size={20} />
            <div>
              <span className="stat-label">Search</span>
            </div>
          </button>
        </div>
      )}

      {showSearch && (
        <form className="search-bar" onSubmit={handleSearch}>
          <div className="search-row">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search all mail…"
              value={searchParams.q}
              onChange={(e) => setSearchParams({ ...searchParams, q: e.target.value })}
            />
            <button type="button" className="search-clear" onClick={clearSearch} title="Clear search">
              <X size={16} />
            </button>
          </div>
          <div className="search-filters">
            <input
              type="text"
              placeholder="Sender"
              value={searchParams.sender}
              onChange={(e) => setSearchParams({ ...searchParams, sender: e.target.value })}
            />
            <input
              type="text"
              placeholder="Receiver"
              value={searchParams.receiver}
              onChange={(e) => setSearchParams({ ...searchParams, receiver: e.target.value })}
            />
            <input
              type="date"
              value={searchParams.dateFrom}
              onChange={(e) => setSearchParams({ ...searchParams, dateFrom: e.target.value })}
              title="From date"
            />
            <input
              type="date"
              value={searchParams.dateTo}
              onChange={(e) => setSearchParams({ ...searchParams, dateTo: e.target.value })}
              title="To date"
            />
          </div>
          <button type="submit" className="btn btn-primary search-submit" disabled={isSearching}>
            {isSearching ? 'Searching…' : 'Search'}
          </button>
        </form>
      )}

      {mail.length > 0 && (
        <div className="filter-bar">
          {['all', 'action_needed', 'bill', 'personal', 'government', 'financial', 'medical', 'reminder'].map((f) => (
            <button
              key={f}
              className={`filter-chip ${activeFilter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'action_needed' ? 'Needs Action' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'action_needed' && newCount > 0 && <span className="filter-count">{newCount}</span>}
            </button>
          ))}
        </div>
      )}

      {mail.length === 0 ? (
        <div className="empty-state">
          <Inbox size={64} strokeWidth={1} />
          <h3>No mail scanned yet</h3>
          <p>Scan your first piece of mail to get started</p>
          <Link to="/scan" className="btn btn-primary">
            <ScanLine size={20} />
            <span>Scan Mail</span>
          </Link>
        </div>
      ) : (
        <div className="mail-list">
          {filtered.map((item) => (
            <Link to={`/mail/${item.id}`} key={item.id} className="mail-link">
              <MailCard item={item} />
              <ChevronRight size={18} className="chevron" />
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="no-results">No mail matches this filter.</p>
          )}
        </div>
      )}

      {/* Shared with me */}
      {sharedMail.length > 0 && (
        <div className="shared-section">
          <button className="shared-section-header" onClick={() => setSharedExpanded((v) => !v)}>
            <Users size={16} />
            <span>Shared with you ({sharedMail.length})</span>
            {sharedExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {sharedExpanded && (
            <div className="mail-list">
              {sharedMail.map((item) => (
                <Link to={`/mail/${item.id}`} key={item.id} className="mail-link">
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
