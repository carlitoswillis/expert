const fs = require('fs');

// Pure-JS PDF text extraction. Replaces the old `pdf-extract` pipeline that
// shelled out to poppler/ghostscript/tesseract and broke on modern Node.
//
// We require pdf-parse's lib entry point directly: its package index runs a
// debug block (reading a bundled test PDF) when loaded without a parent module,
// which we want to avoid.
// eslint-disable-next-line import/no-unresolved
let pdfParse;
try {
  // eslint-disable-next-line global-require
  pdfParse = require('pdf-parse/lib/pdf-parse.js');
} catch {
  pdfParse = null;
}

const normalize = (text) => String(text || '')
  .replace(/\s+/g, ' ')
  .trim()
  // Re-join words split across line breaks with a hyphen ("knowl- edge").
  .split('- ')
  .join('');

/**
 * Extract text from a PDF file. Best-effort: returns '' rather than throwing so
 * a malformed/scanned PDF still gets recorded (just without searchable text).
 * Scanned-image PDFs need OCR — see the legacy pipeline in /process.
 */
async function extractPdfText(filePath) {
  if (!pdfParse) return '';
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return normalize(data.text);
  } catch (err) {
    console.error(`[extract] failed for ${filePath}:`, err.message);
    return '';
  }
}

module.exports = { extractPdfText, normalize };
