import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { getMailByContact } from '../services/api';
import { formatDate } from '../utils';
import MailCard from './MailCard';
import { useTranslation } from 'react-i18next';

export default function ContactDetail() {
  const { t } = useTranslation();
  const { name } = useParams();
  const navigate = useNavigate();
  const contactName = decodeURIComponent(name);
  const [mail, setMail] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMailByContact(contactName)
      .then(setMail)
      .catch(() => navigate('/directory'))
      .finally(() => setLoading(false));
  }, [contactName, navigate]);

  if (loading) return <div className="loading">{t('common.loading')}</div>;

  const senderMail = mail.filter((m) => m.sender?.toLowerCase() === contactName.toLowerCase());
  const receiverMail = mail.filter((m) => m.receiver?.toLowerCase() === contactName.toLowerCase());

  return (
    <div className="contact-detail">
      <div className="detail-header">
        <button className="back-btn" onClick={() => navigate('/directory')}>
          <ArrowLeft size={20} /> {t('contact.backToDirectory')}
        </button>
      </div>

      <div className="contact-detail-header">
        <h2>{contactName}</h2>
        <p className="contact-detail-count">{t(mail.length === 1 ? 'contact.mailItems_one' : 'contact.mailItems_other', { count: mail.length })}</p>
      </div>

      {senderMail.length > 0 && (
        <div className="contact-section">
          <h3>{t('contact.sentBy', { name: contactName, count: senderMail.length })}</h3>
          <div className="mail-list">
            {senderMail.map((item) => (
              <Link to={`/mail/${item.id}`} key={item.id} className="mail-link" state={{ from: '/directory' }}>
                <MailCard item={item} />
                <ChevronRight size={18} className="chevron" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {receiverMail.length > 0 && (
        <div className="contact-section">
          <h3>{t('contact.addressedTo', { name: contactName, count: receiverMail.length })}</h3>
          <div className="mail-list">
            {receiverMail.map((item) => (
              <Link to={`/mail/${item.id}`} key={item.id} className="mail-link" state={{ from: '/directory' }}>
                <MailCard item={item} />
                <ChevronRight size={18} className="chevron" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
