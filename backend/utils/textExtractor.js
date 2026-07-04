import fetch from 'node-fetch';
import mammoth from 'mammoth';

/**
 * Download a remote file and return a Buffer.
 */
async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Extract text from a PDF buffer.
 * Dynamic import avoids the broken top-level test-file side-effect in pdf-parse.
 */
async function extractPDF(buffer) {
  const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');

  const data = await pdfParse(buffer, {
    // Increase page limit for large documents
    max: 0,
  });

  const text = (data.text || '').trim();

  if (!text || text.length < 20) {
    throw new Error(
      'This PDF appears to be scanned or image-based — it contains no selectable text. ' +
      'Please use the "Paste Text" tab and copy-paste the content manually, ' +
      'or use a PDF with real text (not a scan).'
    );
  }

  // Clean up common PDF extraction artifacts
  const cleaned = text
    .replace(/\f/g, '\n')           // form-feed → newline
    .replace(/[ \t]{3,}/g, '  ')     // collapse excessive whitespace
    .replace(/\n{4,}/g, '\n\n\n') // max 3 consecutive newlines
    .trim();

  return cleaned;
}

/**
 * Extract text from a DOCX buffer via mammoth.
 */
async function extractDOCX(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return (result.value || '').trim();
}

/**
 * Extract text from a PPTX file using JSZip + XML parsing.
 *
 * PPTX structure:
 *   ppt/slides/slide1.xml
 *   ppt/slides/slide2.xml  …
 *
 * Each slide XML contains text in <a:t> elements.
 * We unzip properly (binary-safe) then parse the XML.
 */
async function extractPPTX(buffer) {
  // Dynamically import JSZip so the module stays ESM-clean
  const { default: JSZip } = await import('jszip');

  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err) {
    throw new Error(`Could not open PPTX as ZIP: ${err.message}`);
  }

  // Collect all slide XML files in slide order
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      // sort by slide number
      const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0');
      const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0');
      return numA - numB;
    });

  if (slideFiles.length === 0) {
    // Fallback: try any XML that might have text
    const anyXml = Object.keys(zip.files).filter(n => n.endsWith('.xml') && !zip.files[n].dir);
    if (anyXml.length === 0) throw new Error('No XML found inside PPTX ZIP');
    slideFiles.push(...anyXml.slice(0, 20));
  }

  const slideTexts = [];

  for (const filename of slideFiles) {
    const xmlStr = await zip.files[filename].async('string');

    // Extract all <a:t> text runs — these hold the actual displayed text
    // Also handle <a:t> without namespace prefix (some tools omit it)
    const textRunRegex = /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g;
    const paraRegex    = /<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g;

    const paragraphs = [];
    let paraMatch;

    while ((paraMatch = paraRegex.exec(xmlStr)) !== null) {
      const paraContent = paraMatch[1];
      const runs = [];
      let runMatch;
      const runRe = /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g;
      while ((runMatch = runRe.exec(paraContent)) !== null) {
        const text = runMatch[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
          .trim();
        if (text) runs.push(text);
      }
      if (runs.length > 0) paragraphs.push(runs.join(' '));
    }

    // Fallback if paragraph parsing caught nothing — try raw text run regex
    if (paragraphs.length === 0) {
      let m;
      while ((m = textRunRegex.exec(xmlStr)) !== null) {
        const t = m[1].trim();
        if (t) paragraphs.push(t);
      }
    }

    if (paragraphs.length > 0) {
      slideTexts.push(paragraphs.join('\n'));
    }
  }

  const fullText = slideTexts
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!fullText) {
    throw new Error('PPTX contained no extractable text — it may use images or embedded objects instead of text boxes.');
  }

  return fullText;
}

/**
 * Master extractor.
 * Detects file type, downloads from Cloudinary, extracts text.
 * Returns cached extractedText if already populated.
 *
 * @param {object} material  Mongoose Material document (or plain object)
 * @returns {Promise<string>} Extracted plain text
 */
export async function extractTextFromMaterial(material) {
  const { fileType, cloudinaryUrl, extractedText } = material;

  // Return cached result — avoids re-downloading and re-processing
  if (extractedText && extractedText.length > 50 && !extractedText.startsWith('[')) {
    return extractedText;
  }

  const ext = (fileType || '').toLowerCase().replace(/^\./, '');

  try {
    if (ext === 'txt') {
      const res = await fetch(cloudinaryUrl);
      if (!res.ok) throw new Error(`TXT fetch failed: ${res.statusText}`);
      return (await res.text()).trim();
    }

    const buffer = await downloadBuffer(cloudinaryUrl);

    if (ext === 'pdf') return await extractPDF(buffer);
    if (ext === 'docx' || ext === 'doc') return await extractDOCX(buffer);
    if (ext === 'pptx') return await extractPPTX(buffer);

    return '[Unsupported file type. Supported formats: PDF, PPTX, DOCX, TXT]';

  } catch (err) {
    console.error(`[textExtractor] ${ext.toUpperCase()} extraction error:`, err.message);

    if (ext === 'pptx') {
      return `[PPTX extraction failed: ${err.message}. Please paste the slide text manually using the "Paste Text" tab.]`;
    }
    if (ext === 'pdf') {
      return `[PDF extraction failed: ${err.message}. The file may be scanned/image-based. Try copy-pasting the text.]`;
    }
    return `[Text extraction failed: ${err.message}]`;
  }
}

/**
 * Split a long text into sentence-aware chunks for the AI.
 *
 * @param {string} text
 * @param {number} maxChunkLen  Max characters per chunk (default 2500)
 * @returns {string[]}
 */
export function chunkText(text, maxChunkLen = 2500) {
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
    // Try to break at a sentence boundary near the limit
    const window = cleaned.slice(start, end);
    const breakPoints = [
      window.lastIndexOf('.\n'),
      window.lastIndexOf('.\n\n'),
      window.lastIndexOf('. '),
      window.lastIndexOf('! '),
      window.lastIndexOf('? '),
      window.lastIndexOf('\n\n'),
    ];
    const best = Math.max(...breakPoints);
    if (best > maxChunkLen * 0.5) {
      end = start + best + 2;
    }
    chunks.push(cleaned.slice(start, end).trim());
    start = end;
  }

  return chunks.filter(c => c.length > 10);
}
