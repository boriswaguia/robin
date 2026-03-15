import { getCategoryColor, getCategoryIcon, formatDate } from '../utils';
import { Loader2, AlertCircle, ShieldX, Mic, AlertTriangle, CheckCircle2, Archive, Reply, CreditCard, CalendarClock, Trash2, Star } from 'lucide-react';

const ACTION_LABELS = {
  archive: { label: 'Archive', icon: Archive },
  reply: { label: 'Reply', icon: Reply },
  pay_bill: { label: 'Pay Bill', icon: CreditCard },
  schedule_followup: { label: 'Follow Up', icon: CalendarClock },
  discard: { label: 'Discard', icon: Trash2 },
  mark_important: { label: 'Important', icon: Star },
};

export default function MailCard({ item, sharedBy }) {
  const isProcessing = item.status === 'processing';
  const isError = item.status === 'error';
  const isRejected = item.status === 'rejected';

  if (isProcessing) {
    return (
      <div className="mail-card processing">
        <div className="mail-card-body">
          <Loader2 size={20} className="spin" />
          <h4>Processing mail…</h4>
          <p>Reading and categorizing your mail</p>
        </div>
        <div className="mail-card-footer">
          <span className="date">{formatDate(item.createdAt)}</span>
        </div>
      </div>
    );
  }

  if (isRejected) {
    return (
      <div className="mail-card error rejected">
        <div className="mail-card-body">
          <ShieldX size={20} />
          <h4>Document rejected</h4>
          <p>{item.extractedText?.replace('Document rejected: ', '') || 'This does not appear to be valid postal mail.'}</p>
        </div>
        <div className="mail-card-footer">
          <span className="date">{formatDate(item.createdAt)}</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mail-card error">
        <div className="mail-card-body">
          <AlertCircle size={20} />
          <h4>Processing failed</h4>
          <p>Could not read this mail. Tap to view details.</p>
        </div>
        <div className="mail-card-footer">
          <span className="date">{formatDate(item.createdAt)}</span>
        </div>
      </div>
    );
  }

  const suggested = item.suggestedActions || [];
  const primaryAction = suggested[0];
  const primaryLabel = primaryAction ? ACTION_LABELS[primaryAction] : null;
  const isActionTaken = item.status !== 'new' && item.status !== 'processing' && item.status !== 'error' && item.status !== 'rejected';
  const PrimaryIcon = primaryLabel?.icon;

  return (
    <div className={`mail-card ${item.status === 'new' ? 'new' : ''} ${suggested.length > 0 && !isActionTaken ? (item.urgency === 'high' ? 'needs-action-urgent' : 'needs-action') : ''}`}>
      <div className="mail-card-top">
        <span className={`category-badge ${getCategoryColor(item.category)}`}>
          {getCategoryIcon(item.category)} {item.category}
        </span>
        {item.source === 'gmail' && <span className="source-badge gmail">Gmail</span>}
        {item.source === 'voice' && <span className="source-badge voice"><Mic size={11} /> Voice</span>}
        {sharedBy && <span className="source-badge shared">via {sharedBy.name}</span>}
        {item.urgency === 'high' && <span className="urgency-badge">Urgent</span>}
        {isActionTaken && <span className="status-badge">{item.actionTaken?.replace('_', ' ') || item.status}</span>}
      </div>
      <div className="mail-card-body">
        <h4>{item.sender || 'Unknown Sender'}</h4>
        <p>{item.summary}</p>
      </div>
      {!isActionTaken && primaryLabel && (
        <div className="mail-card-action-hint">
          <AlertTriangle size={13} />
          <span>{primaryLabel.label}</span>
          {item.dueDate && (() => {
            const diffDays = Math.ceil((new Date(item.dueDate) - new Date()) / 86400000);
            if (diffDays < 0) return <span className="hint-due overdue">{Math.abs(diffDays)}d overdue</span>;
            if (diffDays === 0) return <span className="hint-due overdue">Today</span>;
            if (diffDays <= 7) return <span className="hint-due">{diffDays}d left</span>;
            return null;
          })()}
        </div>
      )}
      {isActionTaken && (
        <div className="mail-card-action-hint done">
          <CheckCircle2 size={13} />
          <span>{ACTION_LABELS[item.actionTaken]?.label || item.actionTaken?.replace('_', ' ')}</span>
        </div>
      )}
      <div className="mail-card-footer">
        {item.amountDue && <span className="amount">{item.amountDue}</span>}
        <span className="date">{formatDate(item.createdAt)}</span>
      </div>
    </div>
  );
}
