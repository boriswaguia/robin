import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, AlertTriangle, Clock, CalendarDays, ChevronRight, Inbox, CheckCircle2, Circle } from 'lucide-react';
import { getAgenda, performAction } from '../services/api';
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

function AgendaItem({ item, onDone }) {
  const [marking, setMarking] = useState(false);
  const [done, setDone] = useState(false);

  async function handleMarkDone(e) {
    e.preventDefault(); // don't navigate via the Link
    e.stopPropagation();
    if (marking) return;
    setMarking(true);
    try {
      await performAction(item.id, 'archive', 'Marked done from Agenda');
      setDone(true);
      // Let the fade-out animation play, then remove from list
      setTimeout(() => onDone(item.id), 350);
    } catch {
      setMarking(false);
    }
  }

  return (
    <Link to={`/mail/${item.id}`} className={`agenda-item${done ? ' agenda-item-done' : ''}`}>
      <button
        className={`agenda-check${done ? ' checked' : ''}`}
        onClick={handleMarkDone}
        disabled={marking}
        title="Mark as done"
        aria-label="Mark as done"
      >
        {done ? <CheckCircle2 size={22} /> : <Circle size={22} />}
      </button>
      <div className="agenda-item-body">
        <h4>
          <span className={`agenda-cat-dot ${getCategoryColor(item.category)}`}>
            {getCategoryIcon(item.category)}
          </span>
          {item.sender && item.sender !== 'Unknown' ? item.sender : 'Mail'}
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

function AgendaSection({ title, icon: Icon, items, variant, onDone }) {
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
          <AgendaItem key={item.id} item={item} onDone={onDone} />
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

  // Optimistically remove a completed item from all sections
  function handleDone(itemId) {
    setAgenda((prev) => ({
      overdue: prev.overdue.filter((i) => i.id !== itemId),
      thisWeek: prev.thisWeek.filter((i) => i.id !== itemId),
      upcoming: prev.upcoming.filter((i) => i.id !== itemId),
    }));
  }

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
        onDone={handleDone}
      />

      <AgendaSection
        title="Due This Week"
        icon={Clock}
        items={thisWeek}
        variant="thisweek"
        onDone={handleDone}
      />

      <AgendaSection
        title="Upcoming"
        icon={CalendarDays}
        items={upcoming}
        variant="upcoming"
        onDone={handleDone}
      />
    </div>
  );
}
