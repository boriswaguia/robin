import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, FileText, Image, CalendarPlus, ClipboardList, Copy, Check, Link2, Landmark, Pencil, Save, X, Bell, BellOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMailById, deleteMailItem, editMail, setReminder } from '../services/api';
import { getCategoryColor, getCategoryIcon, formatDate } from '../utils';
import { downloadCalendarEvent } from '../services/calendar';
import { extractSepaFields } from '../services/sepa';
import SepaPayModal from './SepaPayModal';
import ActionPanel from './ActionPanel';

const CATEGORIES = ['bill', 'personal', 'government', 'legal', 'medical', 'insurance', 'financial', 'advertisement', 'subscription', 'tax', 'other'];
const URGENCIES = ['low', 'medium', 'high'];

export default function MailDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showText, setShowText] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [showSepa, setShowSepa] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

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

  function startEditing() {
    setEditFields({
      summary: item.summary || '',
      sender: item.sender || '',
      receiver: item.receiver || '',
      category: item.category || 'other',
      urgency: item.urgency || 'low',
      dueDate: item.dueDate || '',
      amountDue: item.amountDue || '',
    });
    setEditing(true);
  }

  async function saveEdits() {
    setSaving(true);
    try {
      const updates = {};
      for (const [key, value] of Object.entries(editFields)) {
        if (value !== (item[key] || '')) {
          updates[key] = value || null;
        }
      }
      if (Object.keys(updates).length > 0) {
        const updated = await editMail(id, updates);
        setItem((prev) => ({ ...prev, ...updated }));
      }
      setEditing(false);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleReminder() {
    try {
      if (item.reminderAt) {
        // Clear reminder
        const updated = await setReminder(id, null);
        setItem((prev) => ({ ...prev, ...updated }));
      } else if (item.dueDate) {
        // Set reminder 2 days before due date
        const due = new Date(item.dueDate);
        const reminder = new Date(due.getTime() - 2 * 24 * 60 * 60 * 1000);
        const reminderDate = reminder > new Date() ? reminder : new Date();
        const updated = await setReminder(id, reminderDate.toISOString());
        setItem((prev) => ({ ...prev, ...updated }));
      } else {
        // No due date — set reminder for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        const updated = await setReminder(id, tomorrow.toISOString());
        setItem((prev) => ({ ...prev, ...updated }));
      }
    } catch (err) {
      alert('Failed to set reminder: ' + err.message);
    }
  }

  if (loading) return <div className="loading">Loading…</div>;
  if (!item) return null;

  const sepaFields = extractSepaFields(item.actionableInfo || []);
  const hasSepa = !!sepaFields.iban;
  const imageUrls = item.imageUrls || [item.imageUrl];
  const isMultiPage = imageUrls.length > 1;

  return (
    <div className="mail-detail">
      <div className="detail-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={20} /> Back
        </button>
        <div className="detail-header-actions">
          {!editing && (
            <button className="edit-btn" onClick={startEditing} title="Edit fields">
              <Pencil size={18} />
            </button>
          )}
          <button className="reminder-btn" onClick={toggleReminder} title={item.reminderAt ? 'Clear reminder' : 'Set reminder'}>
            {item.reminderAt ? <BellOff size={18} /> : <Bell size={18} />}
          </button>
          <button className="delete-btn" onClick={handleDelete}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {item.reminderAt && (
        <div className="reminder-banner">
          <Bell size={14} />
          <span>Reminder set for {new Date(item.reminderAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          <button onClick={toggleReminder}><X size={14} /></button>
        </div>
      )}

      <div className="detail-card">
        <div className="detail-top">
          {editing ? (
            <div className="edit-row">
              <select value={editFields.category} onChange={(e) => setEditFields({ ...editFields, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={editFields.urgency} onChange={(e) => setEditFields({ ...editFields, urgency: e.target.value })}>
                {URGENCIES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          ) : (
            <>
              <span className={`category-badge ${getCategoryColor(item.category)}`}>
                {getCategoryIcon(item.category)} {item.category}
              </span>
              {item.urgency === 'high' && <span className="urgency-badge">Urgent</span>}
              {item.urgency === 'medium' && <span className="urgency-badge medium">Medium</span>}
            </>
          )}
        </div>

        {editing ? (
          <div className="edit-fields">
            <div className="edit-field">
              <label>Sender</label>
              <input value={editFields.sender} onChange={(e) => setEditFields({ ...editFields, sender: e.target.value })} />
            </div>
            <div className="edit-field">
              <label>Receiver</label>
              <input value={editFields.receiver} onChange={(e) => setEditFields({ ...editFields, receiver: e.target.value })} />
            </div>
            <div className="edit-field">
              <label>Summary</label>
              <textarea value={editFields.summary} onChange={(e) => setEditFields({ ...editFields, summary: e.target.value })} rows={2} />
            </div>
            <div className="edit-row">
              <div className="edit-field">
                <label>Amount Due</label>
                <input value={editFields.amountDue} onChange={(e) => setEditFields({ ...editFields, amountDue: e.target.value })} placeholder="e.g. €45.00" />
              </div>
              <div className="edit-field">
                <label>Due Date</label>
                <input type="date" value={editFields.dueDate?.split('T')[0] || ''} onChange={(e) => setEditFields({ ...editFields, dueDate: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
              </div>
            </div>
            <div className="edit-actions">
              <button className="btn btn-primary btn-sm" onClick={saveEdits} disabled={saving}>
                <Save size={16} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)} disabled={saving}>
                <X size={16} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2>{item.sender || 'Unknown Sender'}</h2>
            {item.receiver && item.receiver !== 'Unknown' && (
              <p className="receiver-line">To: {item.receiver}</p>
            )}
            <p className="summary">{item.summary}</p>
          </>
        )}

        {!editing && item.keyDetails && item.keyDetails.length > 0 && (
          <div className="key-details">
            <h4>Key Details</h4>
            <ul>
              {item.keyDetails.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        {!editing && (
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
            {isMultiPage && (
              <div className="meta-item">
                <span className="meta-label">Pages</span>
                <span className="meta-value">{imageUrls.length}</span>
              </div>
            )}
          </div>
        )}

        {!editing && item.dueDate && (
          <button
            className="btn btn-calendar"
            onClick={() => downloadCalendarEvent(item)}
          >
            <CalendarPlus size={18} />
            <span>Add to Calendar</span>
          </button>
        )}

        {!editing && hasSepa && (
          <button className="btn btn-sepa" onClick={() => setShowSepa(true)}>
            <Landmark size={18} />
            <span>Pay via SEPA</span>
          </button>
        )}

        {!editing && item.actionableInfo && item.actionableInfo.length > 0 && (
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
          <button className="toggle-btn" onClick={() => { setShowImage(!showImage); setCurrentPage(0); }}>
            <Image size={16} /> {showImage ? 'Hide' : 'Show'} Original{isMultiPage ? ` (${imageUrls.length} pages)` : ' Image'}
          </button>
          <button className="toggle-btn" onClick={() => setShowText(!showText)}>
            <FileText size={16} /> {showText ? 'Hide' : 'Show'} Extracted Text
          </button>
        </div>

        {showImage && (
          <div className="original-image">
            {isMultiPage && (
              <div className="page-nav">
                <button disabled={currentPage === 0} onClick={() => setCurrentPage((p) => p - 1)}>
                  <ChevronLeft size={18} />
                </button>
                <span>Page {currentPage + 1} of {imageUrls.length}</span>
                <button disabled={currentPage === imageUrls.length - 1} onClick={() => setCurrentPage((p) => p + 1)}>
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
            {imageUrls[currentPage]?.endsWith('.pdf') ? (
              <iframe src={imageUrls[currentPage]} title="Scanned mail PDF" className="pdf-embed" />
            ) : (
              <img src={imageUrls[currentPage]} alt={`Page ${currentPage + 1}`} />
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
