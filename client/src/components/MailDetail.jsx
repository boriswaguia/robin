import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Trash2, FileText, Image, CalendarPlus, ClipboardList, Copy, Check, Link2, Landmark, Pencil, Save, X, Bell, BellOff, ChevronLeft, ChevronRight, Share2, Users, Mic, AlertTriangle, CheckCircle2, Clock, Archive, Reply, CreditCard, CalendarClock, Star, RefreshCw, Undo2 } from 'lucide-react';
import { getMailById, deleteMailItem, editMail, setReminder, performAction, reopenMail, rescanMail, getSharingConnections, getMailShares, toggleMailShare } from '../services/api';
import { getCategoryColor, getCategoryIcon, formatDate } from '../utils';
import { downloadCalendarEvent } from '../services/calendar';
import { extractSepaFields } from '../services/sepa';
import SepaPayModal from './SepaPayModal';
import { useTranslation } from 'react-i18next';

// Categorization actions — label what needs to be done (item stays active)
const CATEGORIZE_ACTIONS = {
  reply: { labelKey: 'mailDetail.toReply', icon: Reply, color: 'green', descKey: 'mailDetail.needsReply' },
  pay_bill: { labelKey: 'mailDetail.toPay', icon: CreditCard, color: 'orange', descKey: 'mailDetail.needsPayment' },
  schedule_followup: { labelKey: 'mailDetail.followUp', icon: CalendarClock, color: 'purple', descKey: 'mailDetail.setFollowUp' },
  mark_important: { labelKey: 'mailDetail.important', icon: Star, color: 'yellow', descKey: 'mailDetail.flagAttention' },
};

// Completion actions — resolve the item
const COMPLETE_ACTIONS = {
  archive: { labelKey: 'mailDetail.archive', icon: Archive, color: 'blue', descKey: 'mailDetail.fileAway' },
  discard: { labelKey: 'mailDetail.discard', icon: Trash2, color: 'red', descKey: 'mailDetail.notNeeded' },
};

// Combined for lookups
const ACTION_CONFIG = { ...CATEGORIZE_ACTIONS, ...COMPLETE_ACTIONS };

const CATEGORIES = ['bill', 'personal', 'government', 'legal', 'medical', 'insurance', 'financial', 'advertisement', 'subscription', 'reminder', 'tax', 'other'];
const URGENCIES = ['low', 'medium', 'high'];

function getDueDaysText(dueDate, t) {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due - now;
  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffDays < 0) return { text: t('mailDetail.daysOverdue', { count: Math.abs(diffDays) }), overdue: true };
  if (diffDays === 0) return { text: t('mailDetail.dueToday'), overdue: true };
  if (diffDays === 1) return { text: t('mailDetail.dueTomorrow'), overdue: false };
  if (diffDays <= 7) return { text: t('mailDetail.dueInDays', { count: diffDays }), overdue: false };
  return { text: t('mailDetail.dueOn', { date: due.toLocaleDateString() }), overdue: false };
}

export default function MailDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showText, setShowText] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [showSepaIdx, setShowSepaIdx] = useState(null); // null = closed, index into ibans array
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  // Action handling
  const [acting, setActing] = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [showActionNote, setShowActionNote] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  // Sharing
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [outgoingConns, setOutgoingConns] = useState([]); // accepted connections where I'm the from
  const [sharedWith, setSharedWith] = useState([]);       // userIds this item is explicitly shared with
  const [shareUpdating, setShareUpdating] = useState(false);
  const [rescanning, setRescanning] = useState(false);

  useEffect(() => {
    getMailById(id)
      .then((data) => {
        setItem(data);
        // Load sharing data only for items we own
        if (!data.readOnly) {
          getSharingConnections()
            .then((c) => setOutgoingConns((c.sent || []).filter((x) => x.status === 'accepted')))
            .catch(() => {});
          getMailShares(id)
            .then((d) => setSharedWith(d.sharedWith || []))
            .catch(() => {});
        }
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-refresh while processing (e.g. after rescan)
  const isProcessing = item?.status === 'processing';
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      getMailById(id).then((data) => setItem(data)).catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [id, isProcessing]);

  async function handleDelete() {
    if (!confirm(t('mailDetail.confirmDelete'))) return;
    await deleteMailItem(id);
    // Go back to wherever the user came from, fallback to Dashboard
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
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

  async function handleShareToggle(userId) {
    const isShared = sharedWith.includes(userId);
    setShareUpdating(true);
    try {
      const result = await toggleMailShare(id, userId, !isShared);
      setSharedWith(result.sharedWith);
    } catch (err) {
      alert('Share failed: ' + err.message);
    } finally {
      setShareUpdating(false);
    }
  }

  async function handleAction(action) {
    if (action === 'reply' || action === 'schedule_followup') {
      setSelectedAction(action);
      setShowActionNote(true);
      return;
    }
    await executeAction(action);
  }

  async function executeAction(action, note = '') {
    setActing(action);
    try {
      const updated = await performAction(item.id, action, note);
      setItem(updated);
      setShowActionNote(false);
      setActionNote('');
      setSelectedAction(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setActing(null);
    }
  }

  if (loading) return <div className="loading">{t('common.loading')}</div>;
  if (!item) return null;

  const sepaFields = extractSepaFields(item.actionableInfo || []);
  const hasSepa = sepaFields.ibans.length > 0;
  // For installment children, use parent's images
  const parentImages = item.parent ? (item.parent.imageUrls || [item.parent.imageUrl]).filter(Boolean) : [];
  const imageUrls = (item.imageUrls || [item.imageUrl]).filter(Boolean).length > 0
    ? (item.imageUrls || [item.imageUrl]).filter(Boolean)
    : parentImages;
  const hasImages = imageUrls.length > 0;
  const isMultiPage = imageUrls.length > 1;
  const hasInstallments = item.installments && item.installments.length > 0;
  const isChildInstallment = !!item.parentId;

  return (
    <div className="mail-detail">
      <div className="detail-header">
        <button className="back-btn" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}>
          <ArrowLeft size={20} /> {t('common.back')}
        </button>
        <div className="detail-header-actions">
          {item.readOnly ? (
            <span className="shared-by-badge"><Users size={14} /> {t('mailDetail.sharedBy', { name: item.sharedBy?.name })}</span>
          ) : (
            <>
              {!editing && item.source !== 'gmail' && item.source !== 'voice' && (
                <button
                  className={`edit-btn ${rescanning ? 'spin-icon' : ''}`}
                  onClick={async () => {
                    setRescanning(true);
                    try {
                      const updated = await rescanMail(id);
                      setItem(updated);
                    } catch (err) {
                      alert('Rescan failed: ' + err.message);
                    } finally {
                      setRescanning(false);
                    }
                  }}
                  disabled={rescanning || item.status === 'processing'}
                  title={t('mailDetail.rescan')}
                >
                  <RefreshCw size={18} />
                </button>
              )}
              {!editing && (
                <button className="edit-btn" onClick={startEditing} title={t('mailDetail.editFields')}>
                  <Pencil size={18} />
                </button>
              )}
              {outgoingConns.length > 0 && item.source !== 'gmail' && (
                <button
                  className={`edit-btn ${showSharePanel ? 'active' : ''}`}
                  onClick={() => setShowSharePanel((v) => !v)}
                  title={t('mailDetail.shareItem')}
                >
                  <Share2 size={18} />
                </button>
              )}
              <button className="reminder-btn" onClick={toggleReminder} title={item.reminderAt ? t('mailDetail.clearReminder') : t('mailDetail.setReminder')}>
                {item.reminderAt ? <BellOff size={18} /> : <Bell size={18} />}
              </button>
              <button className="delete-btn" onClick={handleDelete}>
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Share panel */}
      {showSharePanel && outgoingConns.length > 0 && (
        <div className="share-panel">
          <div className="share-panel-title"><Share2 size={14} /> {t('mailDetail.shareWith')}</div>
          {outgoingConns.map((conn) => {
            const isShared = sharedWith.includes(conn.toUser.id);
            return (
              <label key={conn.id} className="share-row">
                <input
                  type="checkbox"
                  checked={isShared}
                  disabled={shareUpdating}
                  onChange={() => handleShareToggle(conn.toUser.id)}
                />
                <span>
                  <strong>{conn.toUser.name}</strong> <span className="share-email">{conn.toUser.email}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {item.reminderAt && (
        <div className="reminder-banner">
          <Bell size={14} />
          <span>{t('mailDetail.reminderSet', { date: new Date(item.reminderAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) })}</span>
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
              {item.urgency === 'high' && <span className="urgency-badge">{t('mailCard.urgent')}</span>}
              {item.urgency === 'medium' && <span className="urgency-badge medium">{t('mailDetail.medium')}</span>}
              {item.source === 'gmail' && <span className="source-badge gmail">{t('mailCard.gmail')}</span>}
              {item.source === 'voice' && <span className="source-badge voice"><Mic size={11} /> {t('mailCard.voice')}</span>}
              {item.installmentLabel && <span className="source-badge installment">{item.installmentLabel}</span>}
            </>
          )}
        </div>

        {/* === ACTION BANNER === */}
        {!editing && (() => {
          const suggested = item.suggestedActions || [];
          const primaryAction = suggested[0];
          const primaryConfig = primaryAction ? ACTION_CONFIG[primaryAction] : null;
          const dueInfo = getDueDaysText(item.dueDate, t);
          const isCompleted = item.status === 'action_taken' || item.status === 'discarded' || item.status === 'done';
          const hasLabel = item.actionTaken && CATEGORIZE_ACTIONS[item.actionTaken];
          const needsAction = suggested.length > 0 && !isCompleted;
          const PrimaryIcon = primaryConfig?.icon;

          return (
            <div className={`action-banner ${isCompleted ? 'done' : needsAction ? (item.urgency === 'high' ? 'urgent' : item.urgency === 'medium' ? 'medium' : 'action') : 'info'}`}>
              <div className="action-banner-header">
                {isCompleted ? (
                  <>
                    <CheckCircle2 size={20} className="banner-icon done" />
                    <div className="banner-text">
                      <span className="banner-title">{t('mailDetail.done')} — {ACTION_CONFIG[item.actionTaken] ? t(ACTION_CONFIG[item.actionTaken].labelKey) : item.actionTaken}</span>
                      {item.actionNote && <span className="banner-subtitle">{item.actionNote}</span>}
                    </div>
                    {!item.readOnly && (
                      <button
                        className="undo-btn"
                        onClick={async () => {
                          try {
                            const updated = await reopenMail(item.id);
                            setItem(updated);
                          } catch (err) {
                            alert(err.message);
                          }
                        }}
                        title={t('mailDetail.undoReopen')}
                      >
                        <Undo2 size={16} />
                        <span>{t('mailDetail.undo')}</span>
                      </button>
                    )}
                  </>
                ) : needsAction ? (
                  <>
                    <AlertTriangle size={20} className="banner-icon" />
                    <div className="banner-text">
                      <span className="banner-title">
                        {hasLabel ? `${t('mailDetail.labeled')}: ${t(CATEGORIZE_ACTIONS[item.actionTaken].labelKey)}` : t('mailDetail.actionRequired')}
                      </span>
                      <span className="banner-subtitle">
                        {primaryConfig && !hasLabel && `${t('mailDetail.recommended')}: ${t(primaryConfig.labelKey)}`}
                        {hasLabel && item.actionNote && item.actionNote}
                        {!hasLabel && dueInfo && ` · ${dueInfo.text}`}
                        {!hasLabel && item.amountDue && ` · ${item.amountDue}`}
                        {hasLabel && dueInfo && ` · ${dueInfo.text}`}
                        {hasLabel && item.amountDue && ` · ${item.amountDue}`}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} className="banner-icon info" />
                    <div className="banner-text">
                      <span className="banner-title">{t('mailDetail.noActionNeeded')}</span>
                      <span className="banner-subtitle">{t('mailDetail.infoOnly')}</span>
                    </div>
                  </>
                )}
              </div>

              {!isCompleted && !item.readOnly && (
                <div className="action-banner-actions">
                  {/* Done button — always visible for active items */}
                  <button
                    className="action-cta done-btn"
                    onClick={() => executeAction('archive')}
                    disabled={acting !== null}
                  >
                    <CheckCircle2 size={18} />
                    <span>{t('mailDetail.done')}</span>
                  </button>

                  {/* Categorization actions */}
                  <div className="action-secondary-row">
                    {Object.entries(CATEGORIZE_ACTIONS).map(([key, config]) => {
                      const Icon = config.icon;
                      const isActive = item.actionTaken === key;
                      return (
                        <button
                          key={key}
                          className={`action-secondary ${config.color} ${suggested.includes(key) ? 'suggested' : ''} ${isActive ? 'active-label' : ''}`}
                          onClick={() => handleAction(key)}
                          disabled={acting !== null}
                          title={t(config.descKey)}
                        >
                          <Icon size={16} />
                          <span>{t(config.labelKey)}</span>
                        </button>
                      );
                    })}
                    <button
                      className="action-secondary red"
                      onClick={() => handleAction('discard')}
                      disabled={acting !== null}
                      title={t('mailDetail.notNeeded')}
                    >
                      <Trash2 size={16} />
                      <span>{t('mailDetail.discard')}</span>
                    </button>
                  </div>
                </div>
              )}

              {showActionNote && (
                <div className="action-note-input">
                  <textarea
                    placeholder={selectedAction === 'reply' ? t('action.replyPlaceholder') : t('action.followUpPlaceholder')}
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    rows={2}
                  />
                  <div className="action-note-btns">
                    <button className="btn btn-secondary btn-sm" onClick={() => { setShowActionNote(false); setSelectedAction(null); setActionNote(''); }}>{t('common.cancel')}</button>
                    <button className="btn btn-primary btn-sm" onClick={() => executeAction(selectedAction, actionNote)} disabled={acting !== null}>{t('common.confirm')}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {editing ? (
          <div className="edit-fields">
            <div className="edit-field">
              <label>{t('mailDetail.sender')}</label>
              <input value={editFields.sender} onChange={(e) => setEditFields({ ...editFields, sender: e.target.value })} />
            </div>
            <div className="edit-field">
              <label>{t('mailDetail.receiver')}</label>
              <input value={editFields.receiver} onChange={(e) => setEditFields({ ...editFields, receiver: e.target.value })} />
            </div>
            <div className="edit-field">
              <label>{t('mailDetail.summary')}</label>
              <textarea value={editFields.summary} onChange={(e) => setEditFields({ ...editFields, summary: e.target.value })} rows={2} />
            </div>
            <div className="edit-row">
              <div className="edit-field">
                <label>{t('mailDetail.amountDue')}</label>
                <input value={editFields.amountDue} onChange={(e) => setEditFields({ ...editFields, amountDue: e.target.value })} placeholder="e.g. €45.00" />
              </div>
              <div className="edit-field">
                <label>{t('mailDetail.dueDateLabel')}</label>
                <input type="date" value={editFields.dueDate?.split('T')[0] || ''} onChange={(e) => setEditFields({ ...editFields, dueDate: e.target.value || '' })} />
              </div>
            </div>
            <div className="edit-actions">
              <button className="btn btn-primary btn-sm" onClick={saveEdits} disabled={saving}>
                <Save size={16} /> {saving ? t('common.saving') : t('mailDetail.saveChanges')}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)} disabled={saving}>
                <X size={16} /> {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2>{item.sender && item.sender !== 'Unknown' ? item.sender : t('dashboard.mail')}</h2>
            {item.receiver && item.receiver !== 'Unknown' && (
              <p className="receiver-line">{t('mailDetail.to')}: {item.receiver}</p>
            )}
            <p className="summary">{item.summary}</p>
          </>
        )}

        {!editing && item.keyDetails && item.keyDetails.length > 0 && (
          <div className="key-details">
            <h4>{t('mailDetail.keyDetails')}</h4>
            <ul>
              {item.keyDetails.map((d, i) => (
                <li key={i}><Linkified text={d} /></li>
              ))}
            </ul>
          </div>
        )}

        {!editing && (
          <div className="detail-meta">
            {item.amountDue && (
              <div className="meta-item">
                <span className="meta-label">{t('mailDetail.amountDue')}</span>
                <span className="meta-value amount">{item.amountDue}</span>
              </div>
            )}
            {item.dueDate && (
              <div className="meta-item">
                <span className="meta-label">{t('mailDetail.dueDateLabel')}</span>
                <span className="meta-value">{new Date(item.dueDate).toLocaleDateString()}</span>
              </div>
            )}
            <div className="meta-item">
                <span className="meta-label">{t('mailDetail.scanned')}</span>
              <span className="meta-value">{formatDate(item.createdAt)}</span>
            </div>
            {isMultiPage && (
              <div className="meta-item">
                <span className="meta-label">{t('mailDetail.pages')}</span>
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
            <span>{t('mailDetail.addToCalendar')}</span>
          </button>
        )}

        {!editing && hasSepa && sepaFields.ibans.map((entry, idx) => (
          <button key={idx} className="btn btn-sepa" onClick={() => setShowSepaIdx(idx)}>
            <Landmark size={18} />
            <span>{sepaFields.ibans.length > 1 ? t('mailDetail.payLabel', { label: entry.label || entry.iban }) : t('mailDetail.payViaSEPA')}</span>
          </button>
        ))}

        {!editing && item.actionableInfo && item.actionableInfo.length > 0 && (
          <div className="actionable-info">
            <h4><ClipboardList size={16} /> {t('mailDetail.whatYouNeed')}</h4>
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

        {/* Installment breakdown (parent items) */}
        {!editing && hasInstallments && (
          <div className="installment-section">
            <h4><CreditCard size={16} /> {t('mailDetail.paymentSchedule')}</h4>
            <div className="installment-list">
              {item.installments.map((inst) => {
                const isPaid = inst.status === 'action_taken' || inst.status === 'discarded';
                const isOverdue = inst.dueDate && new Date(inst.dueDate) < new Date() && !isPaid;
                return (
                  <Link key={inst.id} to={`/mail/${inst.id}`} className={`installment-row ${isPaid ? 'paid' : ''} ${isOverdue ? 'overdue' : ''}`}>
                    <span className="inst-label">{inst.installmentLabel || t('mailDetail.installment')}</span>
                    <span className="inst-amount">{inst.amountDue || '—'}</span>
                    <span className="inst-due">{inst.dueDate ? formatDate(inst.dueDate) : '—'}</span>
                    {isPaid ? <CheckCircle2 size={14} className="inst-paid-icon" /> : isOverdue ? <AlertTriangle size={14} className="inst-overdue-icon" /> : <Clock size={14} className="inst-pending-icon" />}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Link back to parent document (child installments) */}
        {!editing && isChildInstallment && item.parent && (
          <div className="installment-parent-link">
            <Link to={`/mail/${item.parent.id}`} className="btn btn-outline">
              <Link2 size={16} />
              {t('mailDetail.viewOriginal')}{item.parent.installmentLabel ? ` — ${item.parent.installmentLabel}` : ''}
            </Link>
          </div>
        )}

        <div className="detail-toggles">
          {hasImages && (
            <button className="toggle-btn" onClick={() => { setShowImage(!showImage); setCurrentPage(0); }}>
              <Image size={16} /> {showImage ? t('common.hide') : t('common.show')} {isMultiPage ? t('mailDetail.originalPages', { count: imageUrls.length }) : t('mailDetail.originalImage')}
            </button>
          )}
          <button className="toggle-btn" onClick={() => setShowText(!showText)}>
            <FileText size={16} /> {showText ? t('common.hide') : t('common.show')} {t('mailDetail.extractedText')}
          </button>
        </div>

        {showImage && (
          <div className="original-image">
            {isMultiPage && (
              <div className="page-nav">
                <button disabled={currentPage === 0} onClick={() => setCurrentPage((p) => p - 1)}>
                  <ChevronLeft size={18} />
                </button>
                <span>{t('mailDetail.pageOf', { current: currentPage + 1, total: imageUrls.length })}</span>
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
          <h3><Link2 size={18} /> {t('mailDetail.relatedMail', { count: item.relatedMail.length + 1 })}</h3>
          <div className="related-timeline">
            <div className="timeline-item current">
              <div className="timeline-dot" />
              <div className="timeline-content">
                <span className="timeline-date">{formatDate(item.createdAt)}</span>
                <span className="timeline-summary">{t('mailDetail.thisMail')} — {item.summary}</span>
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

      {showSepaIdx !== null && (
        <SepaPayModal
          item={item}
          sepaFields={{
            iban: sepaFields.ibans[showSepaIdx]?.iban,
            bic: sepaFields.ibans[showSepaIdx]?.bic,
            recipient: sepaFields.recipient,
            reference: sepaFields.reference,
          }}
          onClose={() => setShowSepaIdx(null)}
        />
      )}
    </div>
  );
}

/**
 * Render text with clickable emails and (optionally) phone numbers.
 * Phone linking is opt-in via linkPhones prop to avoid false positives on
 * IBANs, reference numbers, account numbers, etc.
 */
function Linkified({ text, linkPhones = false }) {
  if (!text) return null;
  const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  // Strict phone: must start with + or 0, followed by digits/spaces/dashes, 7-15 digits total
  const phoneRe = /(?:\+\d{1,3}[\s\-]?)?(?:\(?\d{2,5}\)?[\s\-]?)[\d\s\-/]{4,}(?<!\s)/g;

  const pattern = linkPhones
    ? new RegExp(`(${emailRe.source})|(${phoneRe.source})`, 'g')
    : new RegExp(`(${emailRe.source})`, 'g');

  const parts = [];
  let last = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1]) {
      parts.push(<a key={match.index} href={`mailto:${match[1]}`} className="inline-link">{match[1]}</a>);
    } else if (linkPhones && match[2]) {
      const digits = match[2].replace(/[^\d+]/g, '');
      // Only link if it has 7-15 digits (real phone numbers)
      if (digits.replace(/\+/, '').length >= 7 && digits.replace(/\+/, '').length <= 15) {
        parts.push(<a key={match.index} href={`tel:${digits}`} className="inline-link">{match[2]}</a>);
      } else {
        parts.push(match[2]);
      }
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? <>{parts}</> : <>{text}</>;
}

/** Labels that indicate phone/fax values */
const PHONE_LABELS = /telefon|phone|tel\b|handy|mobil|fax|hotline|ruf/i;

function ActionableRow({ label, value, copyable, field, copiedField, setCopiedField }) {
  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }
  const isCopied = copiedField === field;
  const isPhone = PHONE_LABELS.test(label || '');
  return (
    <div className="actionable-row">
      <span className="actionable-label">{label}</span>
      <span className="actionable-value"><Linkified text={value} linkPhones={isPhone} /></span>
      {copyable && (
        <button className="copy-btn" onClick={handleCopy} title="Copy">
          {isCopied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      )}
    </div>
  );
}
