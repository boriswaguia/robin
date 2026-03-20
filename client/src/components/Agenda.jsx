import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, AlertTriangle, Clock, CalendarDays, ChevronRight, Inbox, CheckCircle2, Circle, Undo2 } from 'lucide-react';
import { getAgenda, performAction, reopenMail } from '../services/api';
import { getCategoryColor, getCategoryIcon } from '../utils';
import { useTranslation } from 'react-i18next';

function formatDueDate(iso, t) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((due - today) / 86400000);

  if (diffDays < -1) return t('agenda.daysOverdue', { count: Math.abs(diffDays) });
  if (diffDays === -1) return t('agenda.yesterday');
  if (diffDays === 0) return t('agenda.today');
  if (diffDays === 1) return t('agenda.tomorrow');
  if (diffDays <= 7) return t('agenda.inDays', { count: diffDays });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function AgendaItem({ item, onDone, t }) {
  const [marking, setMarking] = useState(false);
  const [done, setDone] = useState(false);

  async function handleMarkDone(e) {
    e.preventDefault();
    e.stopPropagation();
    if (marking) return;
    setMarking(true);
    try {
      await performAction(item.id, 'archive', 'Marked done from Agenda');
      setDone(true);
      setTimeout(() => onDone(item), 350);
    } catch {
      setMarking(false);
    }
  }

  return (
    <Link to={`/mail/${item.id}`} className={`agenda-item${done ? ' agenda-item-done' : ''}`} state={{ from: '/agenda' }}>
      <button
        className={`agenda-check${done ? ' checked' : ''}`}
        onClick={handleMarkDone}
        disabled={marking}
        title={t('agenda.markDone')}
        aria-label={t('agenda.markDone')}
      >
        {done ? <CheckCircle2 size={22} /> : <Circle size={22} />}
      </button>
      <div className="agenda-item-body">
        <h4>
          <span className={`agenda-cat-dot ${getCategoryColor(item.category)}`}>
            {getCategoryIcon(item.category)}
          </span>
          {item.sender && item.sender !== 'Unknown' ? item.sender : t('dashboard.mail')}
        </h4>
        <p>{item.summary}</p>
        <div className="agenda-item-meta">
          {item.amountDue && <span className="agenda-amount">{item.amountDue}</span>}
          <span className="agenda-due">{formatDueDate(item.dueDate, t)}</span>
        </div>
      </div>
      <ChevronRight size={18} className="chevron" />
    </Link>
  );
}

function AgendaSection({ title, icon: Icon, items, variant, onDone, t }) {
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
          <AgendaItem key={item.id} item={item} onDone={onDone} t={t} />
        ))}
      </div>
    </div>
  );
}

export default function Agenda() {
  const { t } = useTranslation();
  const [agenda, setAgenda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [undoItem, setUndoItem] = useState(null);
  const [undoTimer, setUndoTimer] = useState(null);

  useEffect(() => {
    getAgenda()
      .then(setAgenda)
      .catch(() => setAgenda({ overdue: [], thisWeek: [], upcoming: [] }))
      .finally(() => setLoading(false));
  }, []);

  function handleDone(item) {
    if (undoTimer) clearTimeout(undoTimer);

    setAgenda((prev) => ({
      overdue: prev.overdue.filter((i) => i.id !== item.id),
      thisWeek: prev.thisWeek.filter((i) => i.id !== item.id),
      upcoming: prev.upcoming.filter((i) => i.id !== item.id),
    }));

    setUndoItem(item);
    const timer = setTimeout(() => setUndoItem(null), 5000);
    setUndoTimer(timer);
  }

  async function handleUndo() {
    if (!undoItem) return;
    if (undoTimer) clearTimeout(undoTimer);
    try {
      await reopenMail(undoItem.id);
      const fresh = await getAgenda();
      setAgenda(fresh);
    } catch { /* ignore */ }
    setUndoItem(null);
    setUndoTimer(null);
  }

  if (loading) {
    return <div className="loading">{t('agenda.loadingAgenda')}</div>;
  }

  const { overdue, thisWeek, upcoming } = agenda;
  const total = overdue.length + thisWeek.length + upcoming.length;

  if (total === 0) {
    return (
      <div className="dashboard">
        <div className="empty-state">
          <ClipboardList size={64} strokeWidth={1} />
          <h3>{t('agenda.allClear')}</h3>
          <p>{t('agenda.allClearDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard agenda-page">
      <div className="agenda-header">
        <ClipboardList size={24} />
        <div>
          <h2>{t('agenda.pageTitle')}</h2>
          <p className="agenda-subtitle">{t(total === 1 ? 'agenda.itemsCount_one' : 'agenda.itemsCount_other', { count: total })}</p>
        </div>
      </div>

      <AgendaSection
        title={t('agenda.overdue')}
        icon={AlertTriangle}
        items={overdue}
        variant="overdue"
        onDone={handleDone}
        t={t}
      />

      <AgendaSection
        title={t('agenda.dueThisWeek')}
        icon={Clock}
        items={thisWeek}
        variant="thisweek"
        onDone={handleDone}
        t={t}
      />

      <AgendaSection
        title={t('agenda.upcoming')}
        icon={CalendarDays}
        items={upcoming}
        variant="upcoming"
        onDone={handleDone}
        t={t}
      />

      {undoItem && (
        <div className="undo-toast">
          <CheckCircle2 size={16} />
          <span>{t('agenda.markedDone', { sender: undoItem.sender || t('dashboard.mail') })}</span>
          <button className="undo-btn" onClick={handleUndo}>
            <Undo2 size={14} /> {t('common.undo')}
          </button>
        </div>
      )}
    </div>
  );
}
