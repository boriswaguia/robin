import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, AlertTriangle, Clock, CalendarDays, ChevronRight, Inbox, CheckCircle2 } from 'lucide-react';
import { getAgenda } from '../services/api';
import { getCategoryColor, getCategoryIcon } from '../utils';

function formatDueDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((due - today) / 86400000);

  if (diffDays < -1) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `In ${diffDays} days`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function AgendaItem({ item }) {
  const isActionTaken = item.status !== 'new' && item.status !== 'processing' && item.status !== 'error' && item.status !== 'rejected';

  return (
    <Link to={`/mail/${item.id}`} className="agenda-item">
      <div className="agenda-item-left">
        <span className={`agenda-cat ${getCategoryColor(item.category)}`}>
          {getCategoryIcon(item.category)}
        </span>
      </div>
      <div className="agenda-item-body">
        <h4>
          {item.sender && item.sender !== 'Unknown' ? item.sender : 'Mail'}
          {isActionTaken && <CheckCircle2 size={14} className="agenda-done-icon" />}
        </h4>
        <p>{item.summary}</p>
        <div className="agenda-item-meta">
          {item.amountDue && <span className="agenda-amount">{item.amountDue}</span>}
          <span className="agenda-due">{formatDueDate(item.dueDate)}</span>
        </div>
      </div>
      <ChevronRight size={18} className="chevron" />
    </Link>
  );
}

function AgendaSection({ title, icon: Icon, items, variant }) {
  if (items.length === 0) return null;

  return (
    <div className={`agenda-section agenda-${variant}`}>
      <div className="agenda-section-header">
        <Icon size={18} />
        <h3>{title}</h3>
        <span className="agenda-count">{items.length}</span>
      </div>
      <div className="agenda-section-list">
        {items.map((item) => (
          <AgendaItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function Agenda() {
  const [agenda, setAgenda] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAgenda()
      .then(setAgenda)
      .catch(() => setAgenda({ overdue: [], thisWeek: [], upcoming: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading">Loading agenda…</div>;
  }

  const { overdue, thisWeek, upcoming } = agenda;
  const total = overdue.length + thisWeek.length + upcoming.length;

  if (total === 0) {
    return (
      <div className="dashboard">
        <div className="empty-state">
          <ClipboardList size={64} strokeWidth={1} />
          <h3>All clear!</h3>
          <p>You have no upcoming deadlines or overdue items.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard agenda-page">
      <div className="agenda-header">
        <ClipboardList size={24} />
        <div>
          <h2>Agenda</h2>
          <p className="agenda-subtitle">{total} item{total !== 1 ? 's' : ''} need{total === 1 ? 's' : ''} your attention</p>
        </div>
      </div>

      <AgendaSection
        title="Overdue"
        icon={AlertTriangle}
        items={overdue}
        variant="overdue"
      />

      <AgendaSection
        title="Due This Week"
        icon={Clock}
        items={thisWeek}
        variant="thisweek"
      />

      <AgendaSection
        title="Upcoming"
        icon={CalendarDays}
        items={upcoming}
        variant="upcoming"
      />
    </div>
  );
}
