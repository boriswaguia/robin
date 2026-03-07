import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, ScanLine, ChevronRight, AlertTriangle, Search, X } from 'lucide-react';
import { getAllMail, searchMail } from '../services/api';
import MailCard from './MailCard';

export default function Dashboard() {
  const [mail, setMail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showSearch, setShowSearch] = useState(false);
  const [searchParams, setSearchParams] = useState({ q: '', sender: '', receiver: '', dateFrom: '', dateTo: '' });
  const [isSearching, setIsSearching] = useState(false);

  const fetchMail = useCallback(() => {
    return getAllMail()
      .then((items) => setMail(items))
      .catch(() => setMail([]));
  }, []);

  // Fetch mail, and auto-refresh every 3 seconds while any item is still processing
  useEffect(() => {
    let interval;

    function poll() {
      fetchMail()
        .then(() => {
          // re-read from state not possible here, so we check in the setter
        })
        .finally(() => setLoading(false));
    }

    poll();

    // Simple polling: check every 3s
    interval = setInterval(() => {
      setMail((prev) => {
        if (prev.some((m) => m.status === 'processing')) fetchMail();
        return prev;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchMail]);

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

  const filtered = filter === 'all'
    ? mail
    : filter === 'action_needed'
      ? mail.filter((m) => m.status === 'new')
      : mail.filter((m) => m.category === filter);

  const newCount = mail.filter((m) => m.status === 'new').length;
  const urgentCount = mail.filter((m) => m.urgency === 'high' && m.status === 'new').length;

  if (loading) {
    return <div className="loading">Loading your mail…</div>;
  }

  return (
    <div className="dashboard">
      {mail.length > 0 && (
        <div className="stats-row">
          <div className="stat-card">
            <Inbox size={20} />
            <div>
              <span className="stat-number">{newCount}</span>
              <span className="stat-label">Needs Action</span>
            </div>
          </div>
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
          {['all', 'action_needed', 'bill', 'personal', 'government', 'financial', 'medical'].map((f) => (
            <button
              key={f}
              className={`filter-chip ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'action_needed' ? 'Needs Action' : f.charAt(0).toUpperCase() + f.slice(1)}
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
    </div>
  );
}
