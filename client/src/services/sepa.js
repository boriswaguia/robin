/**
 * SEPA payment helpers
 *
 * Supports:
 *  1. EPC GiroCode QR (ISO 20022 / EPC069-12) — scannable by all major European banking apps
 *  2. payto:// URI (RFC 8905)                  — deep link supported by Sparkasse, DKB, Volksbank, etc.
 *  3. Web Share API                            — fallback to share text-formatted details
 */

const LABEL_PATTERNS = {
  iban:      /\biban\b/i,
  bic:       /\bbic\b|\bswift\b/i,
  recipient: /recipient|beneficiary|payee|empf.nger|kontoinhaber|name|inhaber/i,
  reference: /reference|verwendungszweck|memo|remittance|ref\b|betreff|zahlungsreferenz/i,
};

/**
 * Extract SEPA fields from a flexible actionableInfo array.
 * Returns { ibans: [{ iban, bic, label }], recipient, reference } — ibans may be empty.
 * Also includes a legacy `iban` / `bic` pointing to the first entry for backward compat.
 */
export function extractSepaFields(actionableInfo = []) {
  const fields = { ibans: [], recipient: null, reference: null, iban: null, bic: null };

  // First pass: collect IBANs with labels, and find recipient/reference
  for (const item of actionableInfo) {
    const label = item.label || '';
    if (LABEL_PATTERNS.iban.test(label)) {
      fields.ibans.push({
        iban: item.value?.replace(/\s/g, ''),
        bic: null,
        label: label.replace(/\biban\b:?\s*/i, '').trim() || null,
      });
    }
    if (!fields.recipient && LABEL_PATTERNS.recipient.test(label)) fields.recipient = item.value?.trim();
    if (!fields.reference && LABEL_PATTERNS.reference.test(label)) fields.reference = item.value?.trim();
  }

  // Second pass: pair BICs with IBANs by matching bank name in label, or by order
  const unmatchedBics = [];
  for (const item of actionableInfo) {
    const label = item.label || '';
    if (!LABEL_PATTERNS.bic.test(label)) continue;
    const bicLabel = label.replace(/\bbic\b:?\s*|\bswift\b:?\s*/gi, '').trim().toLowerCase();
    const bic = item.value?.trim();
    let matched = false;
    if (bicLabel) {
      for (const entry of fields.ibans) {
        if (!entry.bic && entry.label && entry.label.toLowerCase().includes(bicLabel)) {
          entry.bic = bic;
          matched = true;
          break;
        }
      }
    }
    if (!matched) unmatchedBics.push(bic);
  }
  // Assign remaining BICs by order
  let bicIdx = 0;
  for (const entry of fields.ibans) {
    if (!entry.bic && bicIdx < unmatchedBics.length) {
      entry.bic = unmatchedBics[bicIdx++];
    }
  }

  // Legacy compat: first IBAN
  if (fields.ibans.length > 0) {
    fields.iban = fields.ibans[0].iban;
    fields.bic = fields.ibans[0].bic;
  }

  return fields;
}

/**
 * Build EPC GiroCode v2 payload string.
 * Spec: https://www.europeanpaymentscouncil.eu/document-library/guidance-documents/quick-response-code-guidelines-enable-data-capture-initiation
 *
 * @param {object} p  - { iban, bic, recipient, amount (e.g. "19.98"), currency ("EUR"), reference }
 * @returns {string}  - Newline-separated GiroCode string to encode as QR
 */
export function buildEpcQrString({ iban, bic = '', recipient, amount, currency = 'EUR', reference = '' }) {
  if (!iban) throw new Error('IBAN is required for EPC QR');
  const recipientName = recipient || 'Payment Recipient';

  // Sanitise
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  const cleanName = recipientName.slice(0, 70);
  const amountField = amount ? `${currency}${parseFloat(amount).toFixed(2)}` : '';
  const refField = reference.slice(0, 140);

  return [
    'BCD',        // Service Tag
    '002',        // Version
    '1',          // Character set: UTF-8
    'SCT',        // Identification: SEPA Credit Transfer
    bic || '',    // BIC (optional in SEPA since 2016)
    cleanName,    // Beneficiary name
    cleanIban,    // IBAN
    amountField,  // Amount (empty = user fills in)
    '',           // Purpose code (blank)
    refField,     // Remittance info / Verwendungszweck
    '',           // Beneficiary reference (blank)
  ].join('\n');
}

/**
 * Build a payto:// URI (RFC 8905).
 * Supported by Sparkasse, DKB, Volksbank, Comdirect, and many other European banking apps.
 *
 * @param {object} p  - { iban, recipient, amount, currency, reference }
 * @returns {string}
 */
export function buildPaytoUri({ iban, recipient, amount, currency = 'EUR', reference = '' }) {
  if (!iban) throw new Error('IBAN is required for payto:// URI');

  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  const params = new URLSearchParams();
  if (amount) params.set('amount', `${currency}:${parseFloat(amount).toFixed(2)}`);
  if (reference) params.set('message', reference);
  if (recipient) params.set('receiver-name', recipient);

  const qs = params.toString();
  return `payto://iban/${cleanIban}${qs ? '?' + qs : ''}`;
}

/**
 * Share payment details as plain text via Web Share API (mobile) or copy to clipboard (desktop).
 */
export async function sharePaymentDetails({ iban, bic, recipient, reference, amount, currency = 'EUR' }) {
  const lines = ['SEPA Payment Details', ''];
  if (recipient)  lines.push(`Recipient:  ${recipient}`);
  if (iban)       lines.push(`IBAN:       ${iban}`);
  if (bic)        lines.push(`BIC:        ${bic}`);
  if (amount)     lines.push(`Amount:     ${currency} ${amount}`);
  if (reference)  lines.push(`Reference:  ${reference}`);
  const text = lines.join('\n');

  if (navigator.share) {
    await navigator.share({ title: `Pay ${recipient || 'SEPA Transfer'}`, text });
  } else {
    await navigator.clipboard.writeText(text);
  }
}

/**
 * Parse an amountDue string like "19.98 EUR", "EUR19.98", "$19.98", "19,98 EUR"
 * into { amount: "19.98", currency: "EUR" }
 */
export function parseAmount(amountDue) {
  if (!amountDue) return { amount: null, currency: 'EUR' };
  const normalized = amountDue.replace(',', '.');
  const currencyMatch = normalized.match(/[A-Z]{3}/);
  const numMatch = normalized.match(/\d+(\.\d+)?/);
  return {
    amount: numMatch ? numMatch[0] : null,
    currency: currencyMatch ? currencyMatch[0] : 'EUR',
  };
}
