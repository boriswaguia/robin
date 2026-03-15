import { getCategoryColor, getCategoryIcon, formatDate } from '../utils';
import { Loader2, AlertCircle, ShieldX, Mic, AlertTriangle, CheckCircle2, Archive, Reply, CreditCard, CalendarClock, Trash2, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ACTION_KEYS = {
  archive: 'mailCard.archived',
  reply: 'mailCard.toReply',
  pay_bill: 'mailCard.toPay',
  schedule_followup: 'mailCard.followUp',
  discard: 'mailCard.discarded',
  mark_important: 'mailCard.important',
};

const ACTION_ICONS = {
  archive: Archive,
  reply: Reply,
  pay_bill: CreditCard,
  schedule_followup: CalendarClock,
  discard: Trash2,
  mark_important: Star,
};

// Categorization actions keep item active — only archive/discard resolve
const RESOLVING_ACTIONS = ['archive', 'discard'];

export default function MailCard({ item, sharedBy }) {
  const { t } = useTranslation();
  const isProcessing = item.status === 'processing';
  const isError = item.status === 'error';
  const isRejected = item.status === 'rejected';

  if (isProcessing) {
    return (
      <div className="mail-card processing">
        <div className="mail-card-body">
          <Loader2 size={20} className="spin" />
          <h4>{t('mailCard.processing')}</h4>
          <p>{t('mailCard.processingDesc')}</p>
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
          <h4>{t('mailCard.rejected')}</h4>
          <p>{item.extractedText?.replace('Document rejected: ', '') || t('mailCard.rejectedFallback')}</p>
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
          <h4>{t('mailCard.errorTitle')}</h4>
          <p>{t('mailCard.errorDesc')}</p>
        </div>
        <div className="mail-card-footer">
          <span className="date">{formatDate(item.createdAt)}</span>
        </div>
      </div>
    );
  }

  const suggested = item.suggestedActions || [];
  const primaryAction = suggested[0];
  const primaryKey = primaryAction ? ACTION_KEYS[primaryAction] : null;
  const isCompleted = item.status === 'action_taken' || item.status === 'discarded';
  const hasLabel = item.actionTaken && !RESOLVING_ACTIONS.includes(item.actionTaken);
  const needsAction = suggested.length > 0 && !isCompleted;
  const PrimaryIcon = primaryAction ? ACTION_ICONS[primaryAction] : null;

  return (
    <div className={`mail-card ${item.status === 'new' ? 'new' : ''} ${needsAction ? (item.urgency === 'high' ? 'needs-action-urgent' : 'needs-action') : ''}`}>
      <div className="mail-card-top">
        <span className={`category-badge ${getCategoryColor(item.category)}`}>
          {getCategoryIcon(item.category)} {item.category}
        </span>
        {item.source === 'gmail' && <span className="source-badge gmail">{t('mailCard.gmail')}</span>}
        {item.source === 'voice' && <span className="source-badge voice"><Mic size={11} /> {t('mailCard.voice')}</span>}
        {sharedBy && <span className="source-badge shared">{t('mailCard.sharedVia', { name: sharedBy.name })}</span>}
        {item.urgency === 'high' && <span className="urgency-badge">{t('mailCard.urgent')}</span>}
        {hasLabel && <span className="status-badge label-badge">{t(ACTION_KEYS[item.actionTaken]) || item.actionTaken?.replace('_', ' ')}</span>}
        {isCompleted && <span className="status-badge">{t(ACTION_KEYS[item.actionTaken]) || item.actionTaken?.replace('_', ' ')}</span>}
        {item.installmentLabel && <span className="status-badge installment-badge">{item.installmentLabel}</span>}
      </div>
      <div className="mail-card-body">
        <h4>{item.sender && item.sender !== 'Unknown' ? item.sender : (item.summary ? t('dashboard.mail') : t('mailCard.unknownSender'))}</h4>
        <p>{item.summary}</p>
      </div>
      {needsAction && primaryKey && (
        <div className="mail-card-action-hint">
          <AlertTriangle size={13} />
          <span>{hasLabel ? t(ACTION_KEYS[item.actionTaken]) : t(primaryKey)}</span>
          {item.dueDate && (() => {
            const diffDays = Math.ceil((new Date(item.dueDate) - new Date()) / 86400000);
            if (diffDays < 0) return <span className="hint-due overdue">{t('mailCard.overdueDays', { count: Math.abs(diffDays) })}</span>;
            if (diffDays === 0) return <span className="hint-due overdue">{t('mailCard.today')}</span>;
            if (diffDays <= 7) return <span className="hint-due">{t('mailCard.daysLeft', { count: diffDays })}</span>;
            return null;
          })()}
        </div>
      )}
      {isCompleted && (
        <div className="mail-card-action-hint done">
          <CheckCircle2 size={13} />
          <span>{t(ACTION_KEYS[item.actionTaken]) || item.actionTaken?.replace('_', ' ')}</span>
        </div>
      )}
      <div className="mail-card-footer">
        {item.amountDue && <span className="amount">{item.amountDue}</span>}
        <span className="date">{formatDate(item.createdAt)}</span>
      </div>
    </div>
  );
}
