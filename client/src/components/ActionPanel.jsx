import { useState } from 'react';
import { Archive, Reply, CreditCard, CalendarClock, Trash2, Star, Check } from 'lucide-react';
import { performAction } from '../services/api';
import { useTranslation } from 'react-i18next';

const ACTION_CONFIG = {
  archive: { labelKey: 'action.archive', icon: Archive, color: 'blue' },
  reply: { labelKey: 'action.reply', icon: Reply, color: 'green' },
  pay_bill: { labelKey: 'action.payBill', icon: CreditCard, color: 'orange' },
  schedule_followup: { labelKey: 'action.followUp', icon: CalendarClock, color: 'purple' },
  discard: { labelKey: 'action.discard', icon: Trash2, color: 'red' },
  mark_important: { labelKey: 'action.important', icon: Star, color: 'yellow' },
};

export default function ActionPanel({ item, onUpdate, hidden = false }) {
  if (hidden) return null;
  const { t } = useTranslation();
  const [acting, setActing] = useState(null);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);

  async function handleAction(action) {
    if (action === 'reply' || action === 'schedule_followup') {
      setSelectedAction(action);
      setShowNote(true);
      return;
    }
    await executeAction(action);
  }

  async function executeAction(action, actionNote = '') {
    setActing(action);
    try {
      const updated = await performAction(item.id, action, actionNote);
      onUpdate(updated);
      setShowNote(false);
      setNote('');
      setSelectedAction(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setActing(null);
    }
  }

  if (item.status !== 'new') {
    return (
      <div className="action-panel done">
        <Check size={20} />
        <span>
          {t('action.actionTaken')}: <strong>{ACTION_CONFIG[item.actionTaken] ? t(ACTION_CONFIG[item.actionTaken].labelKey) : item.actionTaken}</strong>
        </span>
        {item.actionNote && <p className="action-note">{item.actionNote}</p>}
      </div>
    );
  }

  // Determine which actions to show — highlight AI-suggested ones
  const suggested = item.suggestedActions || [];

  return (
    <div className="action-panel">
      <h3>{t('action.whatToDo')}</h3>
      {suggested.length > 0 && (
        <p className="suggestion-hint">{t('action.suggestedHint')}</p>
      )}

      <div className="action-grid">
        {Object.entries(ACTION_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          const isSuggested = suggested.includes(key);
          return (
            <button
              key={key}
              className={`action-btn ${config.color} ${isSuggested ? 'suggested' : ''}`}
              onClick={() => handleAction(key)}
              disabled={acting !== null}
            >
              <Icon size={22} />
              <span>{t(config.labelKey)}</span>
              {isSuggested && <span className="suggested-dot" />}
            </button>
          );
        })}
      </div>

      {showNote && (
        <div className="note-input">
          <textarea
            placeholder={
              selectedAction === 'reply'
                ? t('action.replyPlaceholder')
                : t('action.followUpPlaceholder')
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
          <div className="note-actions">
            <button
              className="btn btn-secondary"
              onClick={() => { setShowNote(false); setSelectedAction(null); setNote(''); }}
            >
              {t('common.cancel')}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => executeAction(selectedAction, note)}
              disabled={acting !== null}
            >
              {t('common.confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
