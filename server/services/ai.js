import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const PROMPT = `You are Robin, a smart postal mail assistant. Look at this image of a piece of postal mail.
First read all the text in the image, then analyze it and return structured information.

You MUST respond with valid JSON only (no markdown, no explanation). Use this exact schema:

{
  "extractedText": "The full raw text you read from the image",
  "summary": "A concise 1-2 sentence summary of what this mail is about",
  "sender": "The sender/organization name (or 'Unknown' if not identifiable)",
  "receiver": "The recipient/addressee name — the person or household the mail is addressed TO (or 'Unknown' if not identifiable)",
  "category": "One of: bill, personal, government, legal, medical, insurance, financial, advertisement, subscription, tax, other",
  "urgency": "One of: low, medium, high",
  "dueDate": "Any due date mentioned (ISO string) or null",
  "amountDue": "Any amount due (as string like '$45.00') or null",
  "suggestedActions": ["Array of 2-4 suggested actions from: archive, reply, pay_bill, schedule_followup, discard, mark_important"],
  "keyDetails": ["Array of 3-5 key bullet points extracted from the mail"],
  "actionableInfo": [
    { "label": "Human-readable label", "value": "The extracted value", "copyable": true }
  ]
}

actionableInfo guidance — extract ALL information the recipient needs to take action:
This is a flexible array. Choose the right fields based on document type. Always include copyable: true for values the user would paste elsewhere (account numbers, references, IBANs, phone numbers, emails, URLs, addresses).

For BILLS / INVOICES:
- Recipient (payee / Empfänger)
- IBAN, BIC/SWIFT, account number, routing number, sort code, BSB
- Payment reference (Verwendungszweck, memo, remittance info)
- Invoice/bill number
- Customer/account number
- Payment portal URL if mentioned
- Payment method instructions

For GOVERNMENT notices:
- Reference/case/file number (Aktenzeichen)
- Office name and address
- Phone number, email, website
- Required documents to bring/submit
- Office hours if mentioned

For LEGAL documents:
- Case number (Aktenzeichen)
- Court name and address
- Hearing/appearance date and time
- Attorney/contact name and phone
- Response deadline

For MEDICAL mail:
- Provider/doctor name
- Appointment date and time
- Clinic/hospital address
- Phone number
- Items to bring (insurance card, referral, etc.)
- Patient/member ID

For INSURANCE:
- Policy number
- Claim number
- Agent/adjuster name and phone
- Member/group ID

For TAX:
- Tax year
- Form type (W-2, 1099, Steuerbescheid)
- Tax ID / Steuernummer
- Filing deadline
- Tax office (Finanzamt) and address

For SUBSCRIPTIONS:
- Subscription/membership ID
- Renewal/cancellation deadline
- Portal URL
- Customer service phone/email

For FINANCIAL:
- Account number
- Statement period
- Balance
- Contact/branch info

For ANY document type also look for:
- Any reference numbers, case numbers, customer IDs, policy numbers
- Contact information (phone, email, website, address)
- Deadlines or appointments
- Portal/website URLs
- Instructions on how to respond

Return an empty array [] only if there is truly no actionable information.

Category guidance:
- bill: Utility bills, invoices, payment requests
- personal: Letters from individuals, invitations, thank you notes
- government: Government agencies, DMV, IRS, city/county notices
- legal: Court notices, attorney letters, legal documents
- medical: Hospital bills, insurance EOBs, appointment reminders, lab results
- insurance: Policy updates, claim info, renewal notices
- financial: Bank statements, credit card offers, investment updates
- advertisement: Marketing, coupons, promotional offers
- subscription: Magazine/service renewals, membership notices
- tax: Tax forms (W-2, 1099), assessment notices
- other: Anything that doesn't fit above

Urgency guidance:
- high: Bills due soon, legal deadlines, time-sensitive government notices
- medium: Regular bills, appointment reminders, insurance updates
- low: Advertisements, informational letters, general correspondence`;

const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.pdf': 'application/pdf',
};

/**
 * Scan a mail image: perform OCR and analysis in a single Gemini multimodal call.
 * @param {string} imagePath - Absolute path to the uploaded image
 * @returns {Promise<{ extractedText: string, summary: string, sender: string, category: string, urgency: string, dueDate: string|null, amountDue: string|null, suggestedActions: string[], keyDetails: string[] }>}
 */
export async function analyzeMail(imagePath) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured. Add it to server/.env (get a free key at https://ai.google.dev)');
  }

  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = MIME_MAP[ext] || 'image/jpeg';
  const imageData = fs.readFileSync(imagePath).toString('base64');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-pro-preview',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 20000,
    },
  });

  const result = await model.generateContent([
    { text: PROMPT },
    { inlineData: { mimeType, data: imageData } },
  ]);

  // Check for blocked responses
  const response = result.response;
  if (response.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the request: ${response.promptFeedback.blockReason}`);
  }

  const content = response.text();
  if (!content) throw new Error('No response from Gemini');

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error('Gemini raw response:', content);
    throw new Error(`Gemini returned invalid JSON: ${e.message}`);
  }
}

/**
 * Compare a newly scanned mail against existing items to find related/follow-up mail.
 * Uses a lightweight text-only Gemini call (no image).
 * @param {object} newAnalysis - The analysis result from analyzeMail
 * @param {Array}  existingItems - Array of existing mail items (id, sender, category, summary, keyDetails, actionableInfo, dueDate, amountDue, createdAt)
 * @returns {Promise<string|null>} The ID of the matching mail item, or null
 */
export async function findRelatedMail(newAnalysis, existingItems) {
  if (!existingItems.length) return null;

  const candidates = existingItems.map((m) => ({
    id: m.id,
    sender: m.sender,
    category: m.category,
    summary: m.summary,
    keyDetails: m.keyDetails,
    actionableInfo: m.actionableInfo,
    dueDate: m.dueDate,
    amountDue: m.amountDue,
    date: m.createdAt,
  }));

  const matchPrompt = `You are a postal mail matching assistant. Determine if a NEW piece of mail is a follow-up, reminder, update, or continuation of any EXISTING mail item.

NEW MAIL:
${JSON.stringify({ sender: newAnalysis.sender, category: newAnalysis.category, summary: newAnalysis.summary, keyDetails: newAnalysis.keyDetails, actionableInfo: newAnalysis.actionableInfo, dueDate: newAnalysis.dueDate, amountDue: newAnalysis.amountDue })}

EXISTING MAIL ITEMS:
${JSON.stringify(candidates)}

Match criteria (ANY of these indicate a match):
- Same sender AND same subject matter (same bill, same case, same account)
- Shared reference numbers, case numbers, invoice numbers, policy numbers, account numbers
- One is clearly a follow-up, reminder, second notice, or update of the other
- Same sender AND overlapping customer/account identifiers

Do NOT match just because the sender is the same — the subject matter or reference must also be related.

Respond with valid JSON only:
{ "matchedId": "<id of the matching existing item>" } or { "matchedId": null } if no match.`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-pro-preview',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 256,
      },
    });

    const result = await model.generateContent([{ text: matchPrompt }]);
    const text = result.response.text();
    const parsed = JSON.parse(text);
    return parsed.matchedId || null;
  } catch (err) {
    console.error('Mail matching failed (non-fatal):', err.message);
    return null;
  }
}
