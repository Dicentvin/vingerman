import { callGroqJSON } from '../config/groq.js';
import ReadAloud from '../models/ReadAloud.js';
import User from '../models/User.js';

// ─── Shared segment normaliser ────────────────────────────────────────────────

function normaliseSegments(raw = []) {
  return raw
    .map(s => ({
      text:        String(s.text || '').trim(),
      translation: String(s.translation || '').trim(),
      note:        s.note ? String(s.note).trim() : undefined,
    }))
    .filter(s => s.text.length > 0);
}

function normaliseGlossary(raw = []) {
  return raw
    .map(g => ({
      de:  String(g.de  || '').trim(),
      en:  String(g.en  || '').trim(),
      ipa: g.ipa ? String(g.ipa).trim() : undefined,
    }))
    .filter(g => g.de && g.en);
}

// ─── Generate new AI text ─────────────────────────────────────────────────────

export const generateReadingContent = async (req, res, next) => {
  try {
    const { topic = 'daily life', level = 'A1', type = 'story' } = req.body;

    const typeInstructions = {
      story:       'a short narrative story with characters and a simple plot',
      dialogue:    'a natural dialogue between two people (label speakers as Person A / Person B)',
      news:        'a news article in the style of a German newspaper',
      poem:        'a short poem or song verse (use rhyme and rhythm where appropriate)',
      description: 'a vivid descriptive paragraph about a place, scene, or object',
    };

    const levelGuide = {
      A1: 'Use only very basic vocabulary (top 500 German words), very short sentences (max 8 words), present tense only.',
      A2: 'Use simple vocabulary, short sentences (max 12 words), present and simple past tense.',
      B1: 'Intermediate vocabulary, medium sentences (up to 18 words), present/past/future tense, some subordinate clauses.',
      B2: 'Upper-intermediate vocabulary, longer sentences, varied tenses including subjunctive, idiomatic expressions.',
      C1: 'Advanced vocabulary, complex sentences, full tense range, nuanced expression, authentic native-like text.',
    };

    const parsed = await callGroqJSON(
      `You are an expert German language teacher who creates perfectly leveled reading materials.
You always respond with valid JSON only, no markdown, no preamble.`,
      `Create a German reading text with these parameters:
- Type: ${typeInstructions[type] || typeInstructions.story}
- CEFR Level: ${level}
- Level guidance: ${levelGuide[level] || levelGuide.A1}
- Topic: ${topic}
- Length: approximately 120-200 words

Return a JSON object with EXACTLY this structure:
{
  "title": "A short German title for the text",
  "segments": [
    {
      "text": "One sentence or 2-3 short sentences in German",
      "translation": "Accurate, natural English translation of this segment",
      "note": "Optional: brief grammar tip or cultural note in English (max 70 chars, omit if not useful)"
    }
  ],
  "glossary": [
    {
      "de": "German word as it appears in text",
      "en": "English translation",
      "ipa": "IPA pronunciation e.g. [ˈɡuːtən]"
    }
  ]
}

Rules:
- Split into 4-8 segments — one sentence or 2-3 short sentences per segment
- Every segment MUST have a "translation" field — an accurate, natural-sounding English translation
- Include 8-15 vocabulary words in the glossary — less common or level-appropriate words
- The "note" field is optional — only add genuine grammar insights (e.g. word order, case, separable verb)
- Keep ALL German text strictly within the ${level} CEFR level
- Output ONLY the JSON object`
    );

    if (!parsed.segments?.length) {
      return res.status(500).json({ message: 'AI returned invalid content. Please try again.' });
    }

    const segments = normaliseSegments(parsed.segments);
    const glossary = normaliseGlossary(parsed.glossary);
    const fullText = segments.map(s => s.text).join(' ');
    const title    = String(parsed.title || `${topic} — ${level}`).trim();

    const doc = await ReadAloud.create({ userId: req.userId, title, level, type, topic, fullText, segments, glossary });
    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 5 } });

    res.json({ content: { title, level, segments, glossary, fullText, _id: doc._id } });
  } catch (err) { next(err); }
};

// ─── Process user-pasted text ─────────────────────────────────────────────────

export const processCustomText = async (req, res, next) => {
  try {
    const { text, level = 'B1' } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'Text is required' });

    const truncated = text.trim().substring(0, 3000);

    const parsed = await callGroqJSON(
      `You are a German language expert who annotates reading texts for learners.
You always respond with valid JSON only.`,
      `Annotate this German text for a ${level} level learner.

Text:
"""
${truncated}
"""

Return a JSON object with this structure:
{
  "title": "A short descriptive title (in German or English)",
  "segments": [
    {
      "text": "A sentence or 2-3 short sentences from the ORIGINAL text — reproduce EXACTLY, do NOT change",
      "translation": "Accurate, natural English translation of this segment",
      "note": "Optional brief grammar or cultural note in English (omit if not useful)"
    }
  ],
  "glossary": [
    {
      "de": "word from text",
      "en": "English translation",
      "ipa": "IPA pronunciation"
    }
  ]
}

Rules:
- Reproduce original text faithfully in "text" field — never paraphrase
- Every segment MUST have a "translation" with an accurate English translation
- Split into natural segments (sentences / short paragraphs), 5-10 segments total
- Glossary: pick 8-20 words challenging for a ${level} learner
- Notes: only when there is a genuinely useful grammar insight
- Output ONLY the JSON object`
    );

    if (!parsed.segments?.length) {
      return res.status(500).json({ message: 'Failed to process text. Please try again.' });
    }

    const segments = normaliseSegments(parsed.segments);
    const glossary = normaliseGlossary(parsed.glossary);
    const fullText = segments.map(s => s.text).join(' ');
    const title    = String(parsed.title || 'Custom Text').trim();

    await ReadAloud.create({ userId: req.userId, title, level, type: 'custom', fullText, segments, glossary });

    res.json({ content: { title, level, segments, glossary, fullText } });
  } catch (err) { next(err); }
};

// ─── History & single record ──────────────────────────────────────────────────

export const getHistory = async (req, res, next) => {
  try {
    const history = await ReadAloud.find({ userId: req.userId })
      .select('title level type topic createdAt')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ history });
  } catch (err) { next(err); }
};

export const getSaved = async (req, res, next) => {
  try {
    const doc = await ReadAloud.findOne({ _id: req.params.id, userId: req.userId });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json({ content: doc });
  } catch (err) { next(err); }
};

// ─── Read uploaded material ───────────────────────────────────────────────────

export const readMaterial = async (req, res, next) => {
  try {
    const { materialId, level = 'B1' } = req.body;
    if (!materialId) return res.status(400).json({ message: 'materialId is required' });

    const { default: Material } = await import('../models/Material.js');
    const { extractTextFromMaterial, chunkText } = await import('../utils/textExtractor.js');

    const material = await Material.findOne({ _id: materialId, userId: req.userId });
    if (!material) return res.status(404).json({ message: 'Material not found' });

    let rawText = material.extractedText || '';
    if (!rawText || rawText.length < 50) {
      rawText = await extractTextFromMaterial(material);
      if (rawText.length > 20) {
        await Material.findByIdAndUpdate(material._id, { extractedText: rawText });
      }
    }

    if (!rawText || rawText.startsWith('[')) {
      return res.status(422).json({
        message: rawText || 'Could not extract text from this file. It may be image-based or encrypted.',
      });
    }

    const chunks   = chunkText(rawText, 2500);
    const textForAI = chunks[0];
    const hasMore  = chunks.length > 1;

    const parsed = await callGroqJSON(
      `You are a German language expert who annotates reading material for learners.
You always respond with valid JSON only, no markdown, no preamble.`,
      `Annotate the following text extracted from a learning material for a ${level} CEFR level German learner.

Text:
"""
${textForAI}
"""

Return a JSON object with EXACTLY this structure:
{
  "title": "A short descriptive title for this material (max 8 words)",
  "segments": [
    {
      "text": "A sentence or 2-3 short sentences from the original text — reproduce EXACTLY as-is",
      "translation": "Accurate, natural English translation of this exact segment",
      "note": "Optional: very brief grammar tip or vocabulary note in English (omit if not useful)"
    }
  ],
  "glossary": [
    {
      "de": "German word exactly as it appears",
      "en": "English translation",
      "ipa": "IPA pronunciation e.g. [ˈhʊnt]"
    }
  ]
}

Critical rules:
1. Reproduce the ORIGINAL text faithfully in "text" — never translate or paraphrase the German
2. Every segment MUST have a "translation" field — an accurate English translation of that segment
3. Split into 5-10 natural segments (sentence or 2-3 sentence groups)
4. Glossary: 10-20 words a ${level} learner would benefit from knowing
5. Grammar notes: only when genuinely useful (separable verb, dative, subjunctive etc.)
6. If the text is not in German, translate from the source language to English in the translation field
7. Output ONLY the JSON object`
    );

    if (!parsed.segments?.length) {
      return res.status(500).json({ message: 'AI could not process this material. Please try again.' });
    }

    const segments = normaliseSegments(parsed.segments);
    const glossary = normaliseGlossary(parsed.glossary);
    const fullText = segments.map(s => s.text).join(' ');
    const title    = String(parsed.title || material.title).trim();

    await ReadAloud.create({
      userId: req.userId, title, level, type: 'material',
      topic: material.title, fullText, segments, glossary,
    });

    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 10 } });

    res.json({
      content: { title, level, segments, glossary, fullText },
      hasMore,
      totalChunks: chunks.length,
      materialTitle: material.title,
      fileType: material.fileType,
    });
  } catch (err) { next(err); }
};
