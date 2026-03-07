import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, QrCode, Landmark, Share2, Check, ExternalLink } from 'lucide-react';
import { buildEpcQrString, buildPaytoUri, sharePaymentDetails, parseAmount } from '../services/sepa';

/**
 * Modal that shows EPC GiroCode QR + payto:// deep link for SEPA payments.
 */
export default function SepaPayModal({ item, sepaFields, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrError, setQrError] = useState(null);
  const [shared, setShared] = useState(false);
  const [tab, setTab] = useState('qr'); // 'qr' | 'link'

  const { iban, bic, recipient, reference } = sepaFields;
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
          <h3><Landmark size={18} /> SEPA Payment</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Beneficiary summary */}
        <div className="sepa-summary">
          {recipient && <div className="sepa-row"><span>To</span><strong>{recipient}</strong></div>}
          {iban      && <div className="sepa-row"><span>IBAN</span><code>{iban}</code></div>}
          {bic       && <div className="sepa-row"><span>BIC</span><code>{bic}</code></div>}
          {amount    && <div className="sepa-row"><span>Amount</span><strong className="sepa-amount">{currency} {amount}</strong></div>}
          {reference && <div className="sepa-row"><span>Reference</span><code>{reference}</code></div>}
        </div>

        {/* Tab switcher */}
        <div className="sepa-tabs">
          <button className={`sepa-tab ${tab === 'qr' ? 'active' : ''}`} onClick={() => setTab('qr')}>
            <QrCode size={15} /> QR Code
          </button>
          <button className={`sepa-tab ${tab === 'link' ? 'active' : ''}`} onClick={() => setTab('link')}>
            <ExternalLink size={15} /> Deep Link
          </button>
        </div>

        {tab === 'qr' && (
          <div className="sepa-qr-panel">
            {qrError ? (
              <p className="sepa-error">{qrError}</p>
            ) : qrDataUrl ? (
              <>
                <img src={qrDataUrl} alt="EPC GiroCode" className="sepa-qr-img" />
                <p className="sepa-qr-hint">
                  Scan with your banking app (Sparkasse, DKB, ING, N26, Revolut and most European banking apps support EPC GiroCode)
                </p>
              </>
            ) : (
              <div className="sepa-qr-loading">Generating QR…</div>
            )}
          </div>
        )}

        {tab === 'link' && (
          <div className="sepa-link-panel">
            {paytoUri ? (
              <>
                <a href={paytoUri} className="btn sepa-payto-btn">
                  <ExternalLink size={18} />
                  Open in Banking App
                </a>
                <p className="sepa-qr-hint">
                  Opens your default banking app with payment details pre-filled.<br />
                  Supported by: Sparkasse, DKB, Volksbank, Postbank, Commerzbank, ING (DE), and others.
                </p>
                <div className="sepa-uri-box">
                  <code>{paytoUri}</code>
                </div>
              </>
            ) : (
              <p className="sepa-error">IBAN is required for a payment link.</p>
            )}
          </div>
        )}

        <button className="btn sepa-share-btn" onClick={handleShare}>
          {shared ? <Check size={18} /> : <Share2 size={18} />}
          {shared ? 'Copied!' : 'Share Payment Details'}
        </button>
      </div>
    </div>
  );
}
