import mongoose from 'mongoose';
import { callGroqJSON } from '../config/groq.js';
import User from '../models/User.js';

// ── Model ─────────────────────────────────────────────────────────────────────
const wordSetSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date:      { type: String, required: true },               // YYYY-MM-DD
  category:  { type: String, default: 'mixed' },
  words:     { type: [mongoose.Schema.Types.Mixed], default: [] },
  practiced: { type: Boolean, default: false },
  score:     { type: Number, default: 0 },
}, { timestamps: true });

const WordSet = mongoose.models.WordSet || mongoose.model('WordSet', wordSetSchema);

const todayStr = () => new Date().toISOString().slice(0, 10);

// ── Helpers ───────────────────────────────────────────────────────────────────
const CATEGORY_GUIDES = {
  noun: `Each item is a NOUN. Include "gender" (der/die/das) and "plural" (full plural form with article "die", e.g. "die Häuser").
Do NOT put the article inside "de" — "de" is the bare noun only (e.g. "Haus").`,
  verb: `Each item is a VERB in the infinitive. Include "conjugations" with present-tense forms:
{"ich":"..","du":"..","er":"..","wir":"..","ihr":"..","sie":".."} (forms only, no pronoun).
Also include "tenseExamples" set to null (it is loaded separately).`,
  adjective: `Each item is an ADJECTIVE. Include "comparative" and "superlative" (e.g. "schneller", "am schnellsten").`,
  adverb: 'Each item is an ADVERB (time, place, manner or frequency).',
  preposition: 'Each item is a PREPOSITION. In "tip" state which case(s) it takes (Akkusativ/Dativ/Genitiv/Wechsel).',
  conjunction: 'Each item is a CONJUNCTION. In "tip" say whether it is coordinating or subordinating and its verb position.',
  pronoun: 'Each item is a PRONOUN (personal, reflexive, possessive, relative, etc.). In "tip" state the case/type.',
  mixed: `Mix of nouns, verbs, adjectives, adverbs, prepositions, conjunctions and pronouns. Each item's "category" must be its real type.
Follow the rules for each type: nouns need "gender"+"plural"; verbs need "conjugations"; adjectives need "comparative"+"superlative".`,
};

const BATCH_SIZE = 10;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

const cleanWord = (w, fallbackCategory) => {
  const de = str(w?.de);
  const en = str(w?.en);
  if (!de || !en) return null;

  let category = str(w.category).toLowerCase();
  if (!CATEGORY_GUIDES[category] || category === 'mixed') {
    category = fallbackCategory !== 'mixed' ? fallbackCategory : 'noun';
  }

  const out = {
    de, en, category,
    ipa:       str(w.ipa),
    example:   str(w.example),
    exampleEn: str(w.exampleEn),
    sentences:   Array.isArray(w.sentences)   ? w.sentences.map(str).filter(Boolean)   : [],
    sentencesEn: Array.isArray(w.sentencesEn) ? w.sentencesEn.map(str).filter(Boolean) : [],
    tip:       str(w.tip),
  };

  if (category === 'noun') {
    const g = str(w.gender).toLowerCase();
    if (['der', 'die', 'das'].includes(g)) out.gender = g;
    out.plural = str(w.plural);
  }
  if (category === 'verb' && w.conjugations && typeof w.conjugations === 'object') {
    const c = w.conjugations;
    out.conjugations = {
      ich: str(c.ich), du: str(c.du), er: str(c.er),
      wir: str(c.wir), ihr: str(c.ihr), sie: str(c.sie),
    };
  }
  if (category === 'adjective') {
    out.comparative  = str(w.comparative);
    out.superlative  = str(w.superlative);
  }
  return out;
};

const generateBatch = async (category, n, avoid) => {
  const avoidHint = avoid.length
    ? `\n\nDo NOT use any of these words (already learned): ${avoid.slice(0, 150).join(', ')}`
    : '';

  const parsed = await callGroqJSON(
    `You are an expert German teacher creating vocabulary drills for A1–B1 learners.
Always respond with valid JSON only — no markdown, no text outside the JSON.`,
    `Generate exactly ${n} DIFFERENT German words.
Category: ${category}.
${CATEGORY_GUIDES[category] || CATEGORY_GUIDES.mixed}

For EVERY word provide:
- "de": the German word
- "en": English meaning
- "ipa": IPA pronunciation in square brackets
- "category": one of noun, verb, adjective, adverb, preposition, conjunction, pronoun
- "example": one natural German sentence using the word
- "exampleEn": English translation of the example
- "sentences": array of 3 short German usage sentences
- "sentencesEn": array of the 3 English translations (same order)
- "tip": a short memory tip (max 100 chars)
plus the category-specific fields described above.

Return ONLY: {"words":[ ... ]}${avoidHint}`,
    Math.min(8192, 700 * n + 800)
  );

  return Array.isArray(parsed?.words) ? parsed.words : [];
};

// ── Generate ──────────────────────────────────────────────────────────────────
export const generateWordSet = async (req, res, next) => {
  try {
    const category = CATEGORY_GUIDES[req.body?.category] ? req.body.category : 'mixed';
    const count = Math.min(100, Math.max(1, parseInt(req.body?.count, 10) || 10));

    // words the user has already seen in this category
    const past = await WordSet.find(
      category === 'mixed' ? { userId: req.userId } : { userId: req.userId, category }
    ).sort({ createdAt: -1 }).limit(20).select('words.de').lean();
    const seen = new Set(past.flatMap(s => (s.words || []).map(w => String(w.de || '').toLowerCase())));

    // split into batches and run in parallel
    const batches = [];
    for (let left = count; left > 0; left -= BATCH_SIZE) batches.push(Math.min(BATCH_SIZE, left));

    const results = await Promise.allSettled(
      batches.map(n => generateBatch(category, n, [...seen]))
    );

    const words = [];
    const used = new Set(seen);
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const raw of r.value) {
        const w = cleanWord(raw, category);
        if (!w) continue;
        const key = w.de.toLowerCase();
        if (used.has(key)) continue;
        used.add(key);
        words.push(w);
      }
    }

    if (words.length === 0) {
      return res.status(500).json({ message: 'Word generation failed. Please try again.' });
    }

    const wordSet = await WordSet.create({
      userId: req.userId,
      date: todayStr(),
      category,
      words: words.slice(0, count),
    });

    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 10 } }).catch(() => {});
    res.status(201).json({ wordSet });
  } catch (err) { next(err); }
};

// ── Today's set ───────────────────────────────────────────────────────────────
export const getTodaySet = async (req, res, next) => {
  try {
    const { category } = req.query;
    const filter = { userId: req.userId, date: todayStr() };
    if (category) filter.category = category;
    const wordSet = await WordSet.findOne(filter).sort({ createdAt: -1 });
    res.json({ wordSet: wordSet || null });
  } catch (err) { next(err); }
};

// ── Mark practiced ────────────────────────────────────────────────────────────
export const markPracticed = async (req, res, next) => {
  try {
    const { setId, score } = req.body;
    const s = Math.max(0, Math.min(100, Number(score) || 0));
    const wordSet = await WordSet.findOneAndUpdate(
      { _id: setId, userId: req.userId },
      { practiced: true, score: s },
      { new: true }
    );
    if (!wordSet) return res.status(404).json({ message: 'Word set not found' });
    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: Math.round(s / 5) } }).catch(() => {});
    res.json({ success: true, score: s });
  } catch (err) { next(err); }
};

// ── History ───────────────────────────────────────────────────────────────────
export const getHistory = async (req, res, next) => {
  try {
    const history = await WordSet.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(30)
      .select('_id date category score practiced');
    res.json({ history });
  } catch (err) { next(err); }
};

// ── Verb tenses (Present / Perfekt / Futur I) ─────────────────────────────────
const TENSE_PRONOUNS = ['I', 'you', 'he', 'she', 'it', 'we', 'they'];

const cleanRows = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  return TENSE_PRONOUNS.map((pronoun, i) => {
    const r = list.find(x => str(x?.pronoun).toLowerCase() === pronoun) || list[i] || {};
    return { pronoun, de: str(r.de), en: str(r.en) };
  });
};

export const verbTenses = async (req, res, next) => {
  try {
    const verb = str(req.body?.verb);
    if (!verb || verb.length > 40) {
      return res.status(400).json({ message: 'Please provide a German verb.' });
    }

    const parsed = await callGroqJSON(
      `You are an expert German teacher. Always respond with valid JSON only.`,
      `Give example sentences for the German verb "${verb}" in three tenses.
For each tense write exactly 7 short, natural sentences, one for each pronoun in this order:
I (ich), you (du), he (er), she (sie), it (es), we (wir), they (sie).

Tenses:
- present: Präsens
- past: Perfekt (haben/sein + Partizip II)
- future: Futur I (werden + infinitive)

Each row: {"pronoun":"I|you|he|she|it|we|they","de":"German sentence","en":"English translation"}

Return ONLY:
{"present":[7 rows],"past":[7 rows],"future":[7 rows]}`,
      3000
    );

    const tenseExamples = {
      present: cleanRows(parsed.present),
      past:    cleanRows(parsed.past),
      future:  cleanRows(parsed.future),
    };

    if (!tenseExamples.present.some(r => r.de)) {
      return res.status(500).json({ message: 'Could not generate tenses. Please try again.' });
    }

    res.json({ tenseExamples });
  } catch (err) { next(err); }
};
