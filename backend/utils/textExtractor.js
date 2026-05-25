import fetch from 'node-fetch';
import mammoth from 'mammoth';

/**
 * Download a file from a URL and return a Buffer
 */
async function downloadBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Extract plain text from a PDF buffer using pdf-parse.
 * We import it dynamically to avoid its broken top-level test runner call.
 */
async function extractPDF(buffer) {
  // pdf-parse uses a default test-file path at top level in some builds,
  // dynamic import avoids that side-effect.
  const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
  const data = await pdfParse(buffer);
  return data.text || '';
}

/**
 * Extract text from a DOCX buffer via mammoth
 */
async function extractDOCX(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

/**
 * Extract text from a PPTX file.
 * PPTX is a ZIP archive; we parse the XML slide files inside it.
 */
async function extractPPTX(buffer) {
  // Dynamically import JSZip (used by mammoth already, but we use it directly here)
  try {
    // Try using xml2js to strip XML tags from pptx slide content
    const { parseStringPromise } = await import('xml2js');
    
    // Basic approach: find text between XML tags using regex on the raw buffer text
    // This works because PPTX stores slide text in predictable <a:t> tags
    const str = buffer.toString('utf8', 0, Math.min(buffer.length, 500000));
    
    // Extract all <a:t> text node contents (PowerPoint text runs)
    const matches = str.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
    const text = matches
      .map(m => m.replace(/<[^>]+>/g, '').trim())
      .filter(t => t.length > 1)
      .join(' ');
    
    return text || '[Could not extract text from PPTX — try copy-pasting the text instead]';
  } catch {
    return '[PPTX text extraction failed — try copy-pasting the text instead]';
  }
}

/**
 * Master extractor — detects file type from the stored fileType field
 * and fetches + extracts accordingly.
 *
 * @param {object} material  - Mongoose Material document
 * @returns {string}         - Extracted plain text
 */
export async function extractTextFromMaterial(material) {
  const { fileType, cloudinaryUrl, extractedText } = material;

  // Return cached extraction if already done
  if (extractedText && extractedText.length > 50) {
    return extractedText;
  }

  const ext = (fileType || '').toLowerCase().replace('.', '');

  try {
    if (ext === 'txt') {
      // TXT: fetch directly as text
      const response = await fetch(cloudinaryUrl);
      if (!response.ok) throw new Error('Fetch failed');
      return await response.text();
    }

    const buffer = await downloadBuffer(cloudinaryUrl);

    if (ext === 'pdf') {
      return await extractPDF(buffer);
    }

    if (ext === 'docx' || ext === 'doc') {
      return await extractDOCX(buffer);
    }

    if (ext === 'pptx') {
      return await extractPPTX(buffer);
    }

    return '[Unsupported file type for text extraction]';
  } catch (err) {
    console.error('Text extraction error:', err.message);
    return '[Text extraction failed — the file may be scanned/image-based or corrupted]';
  }
}

/**
 * Chunk a long text into pieces of ~2000 chars for AI processing.
 * Tries to split on sentence boundaries.
 */
export function chunkText(text, maxChunkLen = 2000) {
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  if (cleaned.length <= maxChunkLen) return [cleaned];

  const chunks = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = start + maxChunkLen;
    if (end >= cleaned.length) {
      chunks.push(cleaned.slice(start).trim());
      break;
    }
    // Try to find a sentence end near the limit
    const slice = cleaned.slice(start, end);
    const lastPeriod = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('? '),
      slice.lastIndexOf('\n\n'),
    );
    if (lastPeriod > maxChunkLen * 0.5) {
      end = start + lastPeriod + 2;
    }
    chunks.push(cleaned.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(c => c.length > 0);
}
