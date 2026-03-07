import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, FileText, Image, CalendarPlus, ClipboardList, Copy, Check, Link2, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMailById, deleteMailItem } from '../services/api';
import { getCategoryColor, getCategoryIcon, formatDate } from '../utils';
import { downloadCalendarEvent } from '../services/calendar';
import { extractSepaFields } from '../services/sepa';
import SepaPayModal from './SepaPayModal';
import ActionPanel from './ActionPanel';

export default function MailDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showText, setShowText] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [showSepa, setShowSepa] = useState(false);

  useEffect(() => {
    getMailById(id)
      .then(setItem)
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  async function handleDelete() {
    if (!confirm('Delete this mail item?')) return;
    await deleteMailItem(id);
    navigate('/');
  }

  if (loading) return <div className="loading">Loading…</div>;
  if (!item) return null;

  const sepaFields = extractSepaFields(item.actionableInfo || []);
  const hasSepa = !!sepaFields.iban;

  return (
    <div className="mail-detail">
      <div className="detail-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={20} /> Back
        </button>
        <button className="delete-btn" onClick={handleDelete}>
          <Trash2 size={18} />
        </button>
      </div>

      <div className="detail-card">
        <div className="detail-top">
          <span className={`category-badge ${getCategoryColor(item.category)}`}>
            {getCategoryIcon(item.category)} {item.category}
          </span>
          {item.urgency === 'high' && <span className="urgency-badge">Urgent</span>}
          {item.urgency === 'medium' && <span className="urgency-badge medium">Medium</span>}
        </div>

        <h2>{item.sender || 'Unknown Sender'}</h2>
        {item.receiver && item.receiver !== 'Unknown' && (
          <p className="receiver-line">To: {item.receiver}</p>
        )}
        <p className="summary">{item.summary}</p>

        {item.keyDetails && item.keyDetails.length > 0 && (
          <div className="key-details">
            <h4>Key Details</h4>
            <ul>
              {item.keyDetails.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="detail-meta">
          {item.amountDue && (
            <div className="meta-item">
              <span className="meta-label">Amount Due</span>
              <span className="meta-value amount">{item.amountDue}</span>
            </div>
          )}
          {item.dueDate && (
            <div className="meta-item">
              <span className="meta-label">Due Date</span>
              <span className="meta-value">{new Date(item.dueDate).toLocaleDateString()}</span>
            </div>
          )}
          <div className="meta-item">
            <span className="meta-label">Scanned</span>
            <span className="meta-value">{formatDate(item.createdAt)}</span>
          </div>
        </div>

        {item.dueDate && (
          <button
            className="btn btn-calendar"
            onClick={() => downloadCalendarEvent(item)}
          >
            <CalendarPlus size={18} />
            <span>Add to Calendar</span>
          </button>
        )}

        {hasSepa && (
          <button className="btn btn-sepa" onClick={() => setShowSepa(true)}>
            <Landmark size={18} />
            <span>Pay via SEPA</span>
          </button>
        )}

        {item.actionableInfo && item.actionableInfo.length > 0 && (
          <div className="actionable-info">
            <h4><ClipboardList size={16} /> What You Need</h4>
            <div className="actionable-grid">
              {item.actionableInfo.map((info, i) => (
                <ActionableRow
                  key={i}
                  label={info.label}
                  value={info.value}
                  copyable={info.copyable}
                  field={`info-${i}`}
                  copiedField={copiedField}
                  setCopiedField={setCopiedField}
                />
              ))}
            </div>
          </div>
        )}

        <div className="detail-toggles">
          <button className="toggle-btn" onClick={() => setShowImage(!showImage)}>
            <Image size={16} /> {showImage ? 'Hide' : 'Show'} Original Image
          </button>
          <button className="toggle-btn" onClick={() => setShowText(!showText)}>
            <FileText size={16} /> {showText ? 'Hide' : 'Show'} Extracted Text
          </button>
        </div>

        {showImage && (
          <div className="original-image">
            {item.imageUrl?.endsWith('.pdf') ? (
              <iframe src={item.imageUrl} title="Scanned mail PDF" className="pdf-embed" />
            ) : (
              <img src={item.imageUrl} alt="Scanned mail" />
            )}
          </div>
        )}

        {showText && (
          <pre className="extracted-text">{item.extractedText}</pre>
        )}
      </div>

      {item.relatedMail && item.relatedMail.length > 0 && (
        <div className="related-mail">
          <h3><Link2 size={18} /> Related Mail ({item.relatedMail.length + 1} in thread)</h3>
          <div className="related-timeline">
            {/* Current item marker */}
            <div className="timeline-item current">
              <div className="timeline-dot" />
              <div className="timeline-content">
                <span className="timeline-date">{formatDate(item.createdAt)}</span>
                <span className="timeline-summary">This mail — {item.summary}</span>
              </div>
            </div>
            {item.relatedMail.map((rel) => (
              <Link to={`/mail/${rel.id}`} key={rel.id} className="timeline-item">
                <div className="timeline-dot" />
                <div className="timeline-content">
                  <span className="timeline-date">{formatDate(rel.createdAt)}</span>
                  <span className="timeline-summary">{rel.summary || rel.sender}</span>
                  <div className="timeline-meta">
                    <span className={`category-badge small ${getCategoryColor(rel.category)}`}>
                      {rel.category}
                    </span>
                    {rel.actionTaken && <span className="timeline-action">✓ {rel.actionTaken.replace('_', ' ')}</span>}
                    {rel.amountDue && <span className="timeline-amount">{rel.amountDue}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <ActionPanel item={item} onUpdate={setItem} />

      {showSepa && (
        <SepaPayModal item={item} sepaFields={sepaFields} onClose={() => setShowSepa(false)} />
      )}
    </div>
  );
}

function ActionableRow({ label, value, copyable, field, copiedField, setCopiedField }) {
  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }
  const isCopied = copiedField === field;
  return (
    <div className="actionable-row">
      <span className="actionable-label">{label}</span>
      <span className="actionable-value">{value}</span>
      {copyable && (
        <button className="copy-btn" onClick={handleCopy} title="Copy">
          {isCopied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      )}
    </div>
  );
}
