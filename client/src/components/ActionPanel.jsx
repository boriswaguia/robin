import { useState } from 'react';
import { Archive, Reply, CreditCard, CalendarClock, Trash2, Star, Check } from 'lucide-react';
import { performAction } from '../services/api';

const ACTION_CONFIG = {
  archive: { label: 'Archive', icon: Archive, color: 'blue' },
  reply: { label: 'Reply', icon: Reply, color: 'green' },
  pay_bill: { label: 'Pay Bill', icon: CreditCard, color: 'orange' },
  schedule_followup: { label: 'Follow Up', icon: CalendarClock, color: 'purple' },
  discard: { label: 'Discard', icon: Trash2, color: 'red' },
  mark_important: { label: 'Important', icon: Star, color: 'yellow' },
};

export default function ActionPanel({ item, onUpdate }) {
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
          Action taken: <strong>{ACTION_CONFIG[item.actionTaken]?.label || item.actionTaken}</strong>
        </span>
        {item.actionNote && <p className="action-note">{item.actionNote}</p>}
      </div>
    );
  }

  // Determine which actions to show — highlight AI-suggested ones
  const suggested = item.suggestedActions || [];

  return (
    <div className="action-panel">
      <h3>What would you like to do?</h3>
      {suggested.length > 0 && (
        <p className="suggestion-hint">Suggested actions are highlighted</p>
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
              <span>{config.label}</span>
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
                ? 'Draft your reply notes…'
                : 'When should you follow up?'
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
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => executeAction(selectedAction, note)}
              disabled={acting !== null}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
