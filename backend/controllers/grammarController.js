import mongoose from 'mongoose';
import { callGroqJSON } from '../config/groq.js';
import User from '../models/User.js';
import GrammarWord from '../models/GrammarWord.js';

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

const THEMES = [
  'daily routine and home', 'food, cooking and restaurants', 'travel and transport', 'work and office',
  'family and friends', 'school and learning', 'health and body', 'shopping and money',
  'free time, sports and hobbies', 'feelings and opinions', 'weather, nature and animals', 'city, services and bureaucracy',
];
const pickTheme = () => THEMES[Math.floor(Math.random() * THEMES.length)];

const hasUsage = (w) => !!w.example || (w.sentences && w.sentences.length > 0);

// Which required fields are still missing for this word type?
const missingFields = (w) => {
  const m = [];
  if (!hasUsage(w)) m.push('usage');
  if (w.category === 'verb' && !w.conjugations) m.push('conjugations');
  if (w.category === 'noun' && (!w.gender || !w.plural)) m.push('gender+plural');
  if (w.category === 'adjective' && (!w.comparative || !w.superlative)) m.push('comparative+superlative');
  return m;
};

const normalizeUsage = (w) => {
  // make sure the example is always part of the usage list and translations line up
  if (!w.example && w.sentences.length) {
    w.example = w.sentences[0];
    w.exampleEn = w.sentencesEn[0] || w.exampleEn || '';
    w.sentences = w.sentences.slice(1);
    w.sentencesEn = w.sentencesEn.slice(1);
  }
  while (w.sentencesEn.length < w.sentences.length) w.sentencesEn.push('');
  return w;
};

const generateBatch = async (category, n, avoid, theme) => {
  const avoidHint = avoid.length
    ? `\n\nDo NOT use any of these words (already learned): ${avoid.slice(0, 300).join(', ')}`
    : '';

  const parsed = await callGroqJSON(
    `You are an expert German teacher creating vocabulary drills for A1–B1 learners.
Always respond with valid JSON only — no markdown, no text outside the JSON.`,
    `Generate exactly ${n} DIFFERENT German words.
Category: ${category}.
Vary the words — this time lean towards the theme "${theme}", but stay within the category.
${CATEGORY_GUIDES[category] || CATEGORY_GUIDES.mixed}

For EVERY word provide ALL of these (usage sentences are mandatory):
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
    Math.min(8192, 600 * n + 1200),
    { temperature: 0.7, reasoningEffort: 'low' }
  );

  return Array.isArray(parsed?.words) ? parsed.words : [];
};

// Second pass: fill in anything the first answer left out (usage sentences, conjugations, ...)
const repairWords = async (words) => {
  const broken = words.filter(w => missingFields(w).length);
  if (!broken.length) return;

  for (let i = 0; i < broken.length; i += 12) {
    const chunk = broken.slice(i, i + 12);
    try {
      const parsed = await callGroqJSON(
        `You are an expert German teacher. Always respond with valid JSON only.`,
        `Complete the missing data for these German words (A1–B1 level).
Words: ${JSON.stringify(chunk.map(w => ({ de: w.de, en: w.en, category: w.category, missing: missingFields(w) })))}

For EVERY word return an object with:
- "de": the same German word (unchanged)
- "example": one natural German sentence using it
- "exampleEn": English translation
- "sentences": array of 3 short German usage sentences
- "sentencesEn": array of the 3 English translations (same order)
- verbs: "conjugations" {"ich","du","er","wir","ihr","sie"} present-tense forms only
- nouns: "gender" (der/die/das) and "plural" (e.g. "die Häuser")
- adjectives: "comparative" and "superlative"

Return ONLY: {"words":[ ... ]}`,
        Math.min(8192, 500 * chunk.length + 1200),
        { temperature: 0.5, reasoningEffort: 'low' }
      );
      for (const r of (Array.isArray(parsed?.words) ? parsed.words : [])) {
        const w = chunk.find(x => x.de.toLowerCase() === str(r?.de).toLowerCase());
        if (!w) continue;
        if (!w.example)   w.example   = str(r.example);
        if (!w.exampleEn) w.exampleEn = str(r.exampleEn);
        if (!w.sentences.length) {
          w.sentences   = Array.isArray(r.sentences)   ? r.sentences.map(str).filter(Boolean)   : [];
          w.sentencesEn = Array.isArray(r.sentencesEn) ? r.sentencesEn.map(str).filter(Boolean) : [];
        }
        if (w.category === 'verb' && !w.conjugations && r.conjugations && typeof r.conjugations === 'object') {
          const c = r.conjugations;
          w.conjugations = { ich: str(c.ich), du: str(c.du), er: str(c.er), wir: str(c.wir), ihr: str(c.ihr), sie: str(c.sie) };
        }
        if (w.category === 'noun') {
          const g = str(r.gender).toLowerCase();
          if (!w.gender && ['der', 'die', 'das'].includes(g)) w.gender = g;
          if (!w.plural) w.plural = str(r.plural);
        }
        if (w.category === 'adjective') {
          if (!w.comparative) w.comparative = str(r.comparative);
          if (!w.superlative) w.superlative = str(r.superlative);
        }
      }
    } catch (e) {
      console.error('[grammar] repair pass failed:', e.message);
    }
  }
};

const wordKey = (category, de) => `${category}:${de.toLowerCase()}`;

// Save every generated word into the permanent table (upsert, keeps cached verb tenses).
const saveWords = async (userId, words, setId) => {
  if (!words.length) return;
  await GrammarWord.bulkWrite(words.map(w => ({
    updateOne: {
      filter: { userId, key: wordKey(w.category, w.de) },
      update: {
        $set: {
          de: w.de, en: w.en, category: w.category, ipa: w.ipa || '',
          gender: w.gender || '', plural: w.plural || '',
          conjugations: w.conjugations || null,
          comparative: w.comparative || '', superlative: w.superlative || '',
          example: w.example || '', exampleEn: w.exampleEn || '',
          sentences: w.sentences || [], sentencesEn: w.sentencesEn || [],
          tip: w.tip || '', setId,
        },
      },
      upsert: true,
    },
  })));
};

// One-time import: words from sets generated BEFORE the saved table existed.
const backfillFromSets = async (userId) => {
  try {
    if (await GrammarWord.exists({ userId })) return;
    const sets = await WordSet.find({ userId }).sort({ createdAt: 1 }).lean();
    const byKey = new Map();
    for (const set of sets) {
      for (const raw of set.words || []) {
        const w = cleanWord(raw, set.category);
        if (!w) continue;
        normalizeUsage(w);
        byKey.set(wordKey(w.category, w.de), { w, setId: set._id });   // later sets win
      }
    }
    for (const { w, setId } of byKey.values()) await saveWords(userId, [w], setId);
  } catch (e) {
    console.error('[grammar] backfill failed:', e.message);
  }
};

// ── Generate ──────────────────────────────────────────────────────────────────
export const generateWordSet = async (req, res, next) => {
  try {
    const category = CATEGORY_GUIDES[req.body?.category] ? req.body.category : 'mixed';
    const count = Math.min(100, Math.max(1, parseInt(req.body?.count, 10) || 10));

    // Everything this user has EVER learned in this category (from the permanent table).
    // This is what made verbs "stop working": the model kept re-suggesting the same common verbs,
    // they were all filtered out as duplicates, and the request ended up empty.
    await backfillFromSets(req.userId);
    const seenFilter = category === 'mixed' ? { userId: req.userId } : { userId: req.userId, category };
    const seenDocs = await GrammarWord.find(seenFilter).sort({ createdAt: -1 }).limit(600).select('de').lean();
    const seen = new Set(seenDocs.map(d => d.de.toLowerCase()));

    const words = [];
    const used = new Set(seen);
    const MAX_ROUNDS = 4;

    for (let round = 0; round < MAX_ROUNDS && words.length < count; round++) {
      const need = count - words.length;
      const batches = [];
      for (let left = need; left > 0; left -= BATCH_SIZE) batches.push(Math.min(BATCH_SIZE, left + (round > 0 ? 2 : 0)));

      const avoid = [...used];
      const results = await Promise.allSettled(
        batches.map(n => generateBatch(category, n, avoid, pickTheme()))
      );

      for (const r of results) {
        if (r.status !== 'fulfilled') { console.error('[grammar] batch failed:', r.reason?.message); continue; }
        for (const raw of r.value) {
          const w = cleanWord(raw, category);
          if (!w) continue;
          const key = w.de.toLowerCase();
          if (used.has(key)) continue;
          used.add(key);
          words.push(w);
        }
      }
    }

    if (words.length === 0) {
      return res.status(500).json({ message: 'Word generation failed. Please try again.' });
    }

    const finalWords = words.slice(0, count);
    await repairWords(finalWords);             // make sure usage / conjugations are there
    finalWords.forEach(normalizeUsage);

    const wordSet = await WordSet.create({
      userId: req.userId,
      date: todayStr(),
      category,
      words: finalWords,
    });

    await saveWords(req.userId, finalWords, wordSet._id);

    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 10 } }).catch(() => {});
    res.status(201).json({
      wordSet,
      note: finalWords.length < count
        ? `Only ${finalWords.length} new words could be generated (you already know the rest). Try again for more.`
        : undefined,
    });
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
    const key = wordKey('verb', verb);

    // Already generated before? Read it from the saved table instead of calling the AI again.
    if (!req.body?.refresh) {
      const saved = await GrammarWord.findOne({ userId: req.userId, key }).select('tenseExamples').lean();
      if (saved?.tenseExamples?.present?.some?.(r => r.de)) {
        return res.json({ tenseExamples: saved.tenseExamples, cached: true });
      }
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
      4000,
      { temperature: 0.4, reasoningEffort: 'low' }
    );

    const tenseExamples = {
      present: cleanRows(parsed.present),
      past:    cleanRows(parsed.past),
      future:  cleanRows(parsed.future),
    };

    if (!tenseExamples.present.some(r => r.de)) {
      return res.status(500).json({ message: 'Could not generate tenses. Please try again.' });
    }

    // Save with the verb so it can be opened again later
    await GrammarWord.updateOne(
      { userId: req.userId, key },
      { $set: { tenseExamples }, $setOnInsert: { de: verb, category: 'verb' } },
      { upsert: true }
    );

    res.json({ tenseExamples, cached: false });
  } catch (err) { next(err); }
};

// ── Saved words table ─────────────────────────────────────────────────────────
export const listSavedWords = async (req, res, next) => {
  try {
    await backfillFromSets(req.userId);
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 25));
    const { category, q } = req.query;

    const filter = { userId: req.userId };
    if (category && category !== 'all' && CATEGORY_GUIDES[category]) filter.category = category;
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ de: rx }, { en: rx }];
    }

    const [words, total, counts] = await Promise.all([
      GrammarWord.find(filter).sort({ category: 1, de: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      GrammarWord.countDocuments(filter),
      GrammarWord.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.userId) } },
        { $group: { _id: '$category', n: { $sum: 1 } } },
      ]),
    ]);

    const categoryCounts = {};
    let all = 0;
    for (const c of counts) { categoryCounts[c._id] = c.n; all += c.n; }
    categoryCounts.all = all;

    res.json({ words, total, page, pages: Math.max(1, Math.ceil(total / limit)), counts: categoryCounts });
  } catch (err) { next(err); }
};

export const deleteSavedWord = async (req, res, next) => {
  try {
    const r = await GrammarWord.deleteOne({ _id: req.params.id, userId: req.userId });
    if (!r.deletedCount) return res.status(404).json({ message: 'Word not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// All saved verbs (for the Tenses page picker)
export const listSavedVerbs = async (req, res, next) => {
  try {
    const verbs = await GrammarWord.find({ userId: req.userId, category: 'verb' })
      .sort({ de: 1 }).select('de en tenseExamples.present').lean();
    res.json({
      verbs: verbs.map(v => ({ de: v.de, en: v.en || '', hasTenses: !!v.tenseExamples?.present?.length })),
    });
  } catch (err) { next(err); }
};
