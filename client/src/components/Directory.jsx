import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Send, User, ChevronRight, Search } from 'lucide-react';
import { getContacts } from '../services/api';
import { formatDate } from '../utils';

export default function Directory() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    getContacts()
      .then(setContacts)
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = contacts.filter((c) => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <div className="directory-page">
      <div className="directory-header">
        <h2><Users size={22} /> Directory</h2>
        <span className="directory-count">{contacts.length} contacts</span>
      </div>

      <div className="directory-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="directory-filters">
        {['all', 'sender', 'receiver'].map((t) => (
          <button
            key={t}
            className={`filter-chip ${typeFilter === t ? 'active' : ''}`}
            onClick={() => setTypeFilter(t)}
          >
            {t === 'all' ? 'All' : t === 'sender' ? 'Senders' : 'Receivers'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Users size={48} strokeWidth={1} />
          <h3>{search ? 'No contacts match' : 'No contacts yet'}</h3>
          <p>{search ? 'Try a different search term' : 'Scan some mail to build your directory'}</p>
        </div>
      ) : (
        <div className="contact-list">
          {filtered.map((contact) => (
            <Link
              to={`/directory/${encodeURIComponent(contact.name)}`}
              key={`${contact.type}-${contact.name}`}
              className="contact-card-link"
            >
              <div className="contact-card">
                <div className="contact-avatar">
                  {contact.type === 'sender' ? <Send size={18} /> : <User size={18} />}
                </div>
                <div className="contact-info">
                  <h4>{contact.name}</h4>
                  <div className="contact-meta">
                    <span className="contact-type">{contact.type === 'sender' ? 'Sender' : 'Receiver'}</span>
                    <span className="contact-count">{contact.count} mail{contact.count !== 1 ? 's' : ''}</span>
                    <span className="contact-last">Last: {formatDate(contact.lastDate)}</span>
                  </div>
                  <div className="contact-categories">
                    {contact.categories.slice(0, 4).map((cat) => (
                      <span key={cat} className="contact-cat-tag">{cat}</span>
                    ))}
                  </div>
                </div>
                <ChevronRight size={18} className="chevron" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
