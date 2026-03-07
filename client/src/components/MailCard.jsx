import { getCategoryColor, getCategoryIcon, formatDate } from '../utils';
import { Loader2, AlertCircle, ShieldX } from 'lucide-react';

export default function MailCard({ item }) {
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

  return (
    <div className={`mail-card ${item.status === 'new' ? 'new' : ''}`}>
      <div className="mail-card-top">
        <span className={`category-badge ${getCategoryColor(item.category)}`}>
          {getCategoryIcon(item.category)} {item.category}
        </span>
        {item.urgency === 'high' && <span className="urgency-badge">Urgent</span>}
        {item.status !== 'new' && <span className="status-badge">{item.actionTaken?.replace('_', ' ') || item.status}</span>}
      </div>
      <div className="mail-card-body">
        <h4>{item.sender || 'Unknown Sender'}</h4>
        <p>{item.summary}</p>
      </div>
      <div className="mail-card-footer">
        {item.amountDue && <span className="amount">{item.amountDue}</span>}
        <span className="date">{formatDate(item.createdAt)}</span>
      </div>
    </div>
  );
}
