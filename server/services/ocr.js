import fs from 'fs';
import path from 'path';

const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;
const VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`;

/**
 * Extract text from an image using Google Cloud Vision API.
 * @param {string} imagePath - Absolute path to the image file
 * @returns {Promise<string>} Extracted text
 */
export async function extractText(imagePath) {
  if (!GOOGLE_API_KEY) {
    throw new Error('GOOGLE_CLOUD_API_KEY is not configured. Add it to server/.env');
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const requestBody = {
    requests: [
      {
        image: { content: base64Image },
        features: [
          { type: 'TEXT_DETECTION' },
          { type: 'DOCUMENT_TEXT_DETECTION' },
        ],
      },
    ],
  };

  const response = await fetch(VISION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google Vision API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const annotations = data.responses?.[0];

  if (annotations?.error) {
    throw new Error(`Vision API error: ${annotations.error.message}`);
  }

  // Prefer fullTextAnnotation (DOCUMENT_TEXT_DETECTION) for structured text
  const fullText = annotations?.fullTextAnnotation?.text;
  if (fullText) return fullText;

  // Fallback to TEXT_DETECTION
  const simpleText = annotations?.textAnnotations?.[0]?.description;
  return simpleText || '';
}
