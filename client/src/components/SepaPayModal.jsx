import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, QrCode, Landmark, Share2, Check, ExternalLink } from 'lucide-react';
import { buildEpcQrString, buildPaytoUri, sharePaymentDetails, parseAmount } from '../services/sepa';
import { useTranslation } from 'react-i18next';

/**
 * Modal that shows EPC GiroCode QR + payto:// deep link for SEPA payments.
 */
export default function SepaPayModal({ item, sepaFields, onClose }) {
  const { t } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrError, setQrError] = useState(null);
  const [shared, setShared] = useState(false);
  const [tab, setTab] = useState('qr');

  const { iban, bic, reference } = sepaFields;
  const recipient = sepaFields.recipient || item.sender || null;
  const { amount, currency } = parseAmount(item.amountDue);

  const paytoUri = iban ? buildPaytoUri({ iban, recipient, amount, currency, reference }) : null;

  useEffect(() => {
    try {
      const epcString = buildEpcQrString({ iban, bic, recipient, amount, currency, reference: reference || '' });
      QRCode.toDataURL(epcString, {
        width: 260,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }).then(setQrDataUrl).catch((e) => setQrError(e.message));
    } catch (e) {
      setQrError(e.message);
    }
  }, [iban, bic, recipient, amount, currency, reference]);

  async function handleShare() {
    await sharePaymentDetails({ iban, bic, recipient, reference, amount, currency });
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><Landmark size={18} /> {t('sepa.title')}</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="sepa-summary">
          {recipient && <div className="sepa-row"><span>{t('sepa.to')}</span><strong>{recipient}</strong></div>}
          {iban      && <div className="sepa-row"><span>{t('sepa.iban')}</span><code>{iban}</code></div>}
          {bic       && <div className="sepa-row"><span>{t('sepa.bic')}</span><code>{bic}</code></div>}
          {amount    && <div className="sepa-row"><span>{t('sepa.amount')}</span><strong className="sepa-amount">{currency} {amount}</strong></div>}
          {reference && <div className="sepa-row"><span>{t('sepa.reference')}</span><code>{reference}</code></div>}
        </div>

        <div className="sepa-tabs">
          <button className={`sepa-tab ${tab === 'qr' ? 'active' : ''}`} onClick={() => setTab('qr')}>
            <QrCode size={15} /> {t('sepa.tabQr')}
          </button>
          <button className={`sepa-tab ${tab === 'link' ? 'active' : ''}`} onClick={() => setTab('link')}>
            <ExternalLink size={15} /> {t('sepa.tabDeepLink')}
          </button>
        </div>

        {tab === 'qr' && (
          <div className="sepa-qr-panel">
            {qrError ? (
              <p className="sepa-error">{qrError}</p>
            ) : qrDataUrl ? (
              <>
                <img src={qrDataUrl} alt={t('sepa.qrAlt')} className="sepa-qr-img" />
                <p className="sepa-qr-hint">{t('sepa.qrHint')}</p>
              </>
            ) : (
              <div className="sepa-qr-loading">{t('sepa.qrLoading')}</div>
            )}
          </div>
        )}

        {tab === 'link' && (
          <div className="sepa-link-panel">
            {paytoUri ? (
              <>
                <a href={paytoUri} className="btn sepa-payto-btn">
                  <ExternalLink size={18} />
                  {t('sepa.openBankingApp')}
                </a>
                <p className="sepa-qr-hint">
                  {t('sepa.deepLinkHint')}<br />
                  {t('sepa.deepLinkSupported')}
                </p>
                <div className="sepa-uri-box">
                  <code>{paytoUri}</code>
                </div>
              </>
            ) : (
              <p className="sepa-error">{t('sepa.ibanRequired')}</p>
            )}
          </div>
        )}

        <button className="btn sepa-share-btn" onClick={handleShare}>
          {shared ? <Check size={18} /> : <Share2 size={18} />}
          {shared ? t('sepa.copied') : t('sepa.sharePayment')}
        </button>
      </div>
    </div>
  );
}
