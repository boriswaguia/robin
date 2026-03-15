import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Send, User, ChevronRight, Search } from 'lucide-react';
import { getContacts } from '../services/api';
import { formatDate } from '../utils';
import { useTranslation } from 'react-i18next';

export default function Directory() {
  const { t } = useTranslation();
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

  if (loading) return <div className="loading">{t('common.loading')}</div>;

  return (
    <div className="directory-page">
      <div className="directory-header">
        <h2><Users size={22} /> {t('directory.pageTitle')}</h2>
        <span className="directory-count">{t('directory.contactCount', { count: contacts.length })}</span>
      </div>

      <div className="directory-search">
        <Search size={16} />
        <input
          type="text"
          placeholder={t('directory.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="directory-filters">
        {['all', 'sender', 'receiver'].map((tp) => (
          <button
            key={tp}
            className={`filter-chip ${typeFilter === tp ? 'active' : ''}`}
            onClick={() => setTypeFilter(tp)}
          >
            {tp === 'all' ? t('directory.filterAll') : tp === 'sender' ? t('directory.filterSenders') : t('directory.filterReceivers')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Users size={48} strokeWidth={1} />
          <h3>{search ? t('directory.noMatchTitle') : t('directory.noContactsTitle')}</h3>
          <p>{search ? t('directory.noMatchDesc') : t('directory.noContactsDesc')}</p>
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
                    <span className="contact-type">{contact.type === 'sender' ? t('directory.senderLabel') : t('directory.receiverLabel')}</span>
                    <span className="contact-count">{t(contact.count === 1 ? 'directory.mailCount_one' : 'directory.mailCount_other', { count: contact.count })}</span>
                    <span className="contact-last">{t('directory.lastDate')}{formatDate(contact.lastDate)}</span>
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
