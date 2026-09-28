import { callGroqJSON } from '../config/groq.js';
import { addWordsToLibrary } from './libraryController.js';
import Library from '../models/Library.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

// ── Model ─────────────────────────────────────────────────────────────────────
const wordSchema = new mongoose.Schema({
  de:           { type: String, required: true },
  en:           { type: String, required: true },
  ipa:          { type: String, default: '' },
  category:     { type: String, required: true },
  gender:       { type: String, default: '' },
  plural:       { type: String, default: '' },
  conjugations: {
    ich: String, du: String, er: String,
    wir: String, ihr: String, sie: String,
  },
  comparative:  { type: String, default: '' },
  superlative:  { type: String, default: '' },
  example:      { type: String, default: '' },
  exampleEn:    { type: String, default: '' },
  sentences:    [{ type: String }],
  sentencesEn:  [{ type: String }],
  tip:          { type: String, default: '' },
  tenseExamples: {
    present: [{ pronoun: String, de: String, en: String, _id: false }],
    past:    [{ pronoun: String, de: String, en: String, _id: false }],
    future:  [{ pronoun: String, de: String, en: String, _id: false }],
  },
}, { _id: false });

const wordSetSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:      { type: String, required: true },   // YYYY-MM-DD
  category:  { type: String, required: true },
  words:     [wordSchema],
  practiced: { type: Boolean, default: false },
  score:     { type: Number },
}, { timestamps: true });

wordSetSchema.index({ userId: 1, date: 1, category: 1 });
const WordSet = mongoose.models.WordSet || mongoose.model('WordSet', wordSetSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

const TENSE_PRONOUNS = ['ich', 'du', 'er', 'sie', 'es', 'wir', 'sie'];

function normalizeTenseRow(row) {
  return {
    pronoun: String(row?.pronoun || '').trim(),
    de:      String(row?.de || '').trim(),
    en:      String(row?.en || '').trim(),
  };
}

function normalizeTenseExamples(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const build = (arr) => {
    if (!Array.isArray(arr)) return [];
    const rows = arr.map(normalizeTenseRow).filter(r => r.de && r.en);
    return rows.slice(0, 7).map((r, i) => ({
      ...r,
      pronoun: r.pronoun || TENSE_PRONOUNS[i] || '',
    }));
  };
  const present = build(raw.present);
  const past    = build(raw.past);
  const future  = build(raw.future);
  if (!present.length && !past.length && !future.length) return undefined;
  return { present, past, future };
}

const keyOf = (de) => String(de || '').toLowerCase().replace(/^(der|die|das)\s+/i, '');

// NOTE: tense_examples are NOT in the bulk prompts (too many tokens).
// They are generated per verb on the Tense page via generateVerbTenses below.
const CATEGORY_PROMPTS = {
  noun: `Generate {count} German nouns.
For each word include:
- "de": the noun WITH its definite article (e.g. "der Hund")
- "en": English meaning
- "ipa": IPA pronunciation in brackets
- "category": "noun"
- "gender": "der" | "die" | "das"
- "plural": plural form with article (e.g. "die Hunde")
- "example": a short example sentence in German
- "example_en": English translation of example
- "sentences": array of 3 varied German sentences using this word
- "sentences_en": English translations of each sentence in the same order
- "tip": short memory trick for the gender`,

  verb: `Generate {count} German verbs (mix of regular and irregular).
For each word include:
- "de": infinitive form (e.g. "laufen")
- "en": English meaning
- "ipa": IPA pronunciation
- "category": "verb"
- "conjugations": object with keys ich/du/er/wir/ihr/sie (present tense forms)
- "example": example sentence using the verb
- "example_en": English translation
- "sentences": array of 3 varied German sentences using this verb
- "sentences_en": English translations in the same order
- "tip": short note if irregular, separable, or takes sein in Perfekt`,

  adjective: `Generate {count} German adjectives.
For each word include:
- "de": base form of adjective
- "en": English meaning
- "ipa": IPA pronunciation
- "category": "adjective"
- "comparative": comparative form (e.g. "größer")
- "superlative": superlative form (e.g. "am größten")
- "example": example sentence
- "example_en": English translation
- "sentences": array of 3 German sentences showing the adjective in use
- "sentences_en": English translations in the same order
- "tip": short usage note or common pairing`,

  adverb: `Generate {count} German adverbs (time, manner, place, frequency).
For each word include:
- "de": the adverb
- "en": English meaning
- "ipa": IPA pronunciation
- "category": "adverb"
- "example": example sentence
- "example_en": English translation
- "sentences": array of 3 varied German sentences
- "sentences_en": English translations in the same order
- "tip": which type of adverb (time/manner/place/frequency)`,

  preposition: `Generate {count} German prepositions.
For each word include:
- "de": the preposition
- "en": English meaning(s)
- "ipa": IPA pronunciation
- "category": "preposition"
- "example": example sentence
- "example_en": English translation
- "sentences": array of 3 German sentences showing correct cases
- "sentences_en": English translations in the same order
- "tip": which case it takes (Accusative / Dative / Genitive / both)`,

  conjunction: `Generate {count} German conjunctions (coordinating and subordinating).
For each word include:
- "de": the conjunction
- "en": English equivalent
- "ipa": IPA pronunciation
- "category": "conjunction"
- "example": example sentence showing word order
- "example_en": English translation
- "sentences": array of 3 German sentences
- "sentences_en": English translations in the same order
- "tip": coordinating or subordinating and the word order rule`,

  pronoun: `Generate {count} German pronouns (personal, reflexive, relative, demonstrative).
For each word include:
- "de": the pronoun
- "en": English equivalent
- "ipa": IPA pronunciation
- "category": "pronoun"
- "example": example sentence
- "example_en": English translation
- "sentences": array of 3 German sentences
- "sentences_en": English translations in the same order
- "tip": type of pronoun and its case`,

  mixed: `Generate {count} useful German words — mix of nouns, verbs, adjectives, adverbs and prepositions.
For each word include the relevant fields:
- "de": word (nouns include article, e.g. "der Hund")
- "en": English meaning
- "ipa": IPA pronunciation
- "category": "noun"|"verb"|"adjective"|"adverb"|"preposition"|"conjunction"|"pronoun"
- "gender": only for nouns
- "plural": only for nouns
- "conjugations": only for verbs (ich/du/er/wir/ihr/sie)
- "comparative"/"superlative": only for adjectives
- "example": example sentence
- "example_en": English translation
- "sentences": array of 3 varied German sentences
- "sentences_en": English translations in the same order
- "tip": short helpful memory note`,
};

function normalizeWord(w, category) {
  return {
    de:          String(w.de || '').trim(),
    en:          String(w.en || '').trim(),
    ipa:         String(w.ipa || '').trim(),
    category:    String(w.category || category).trim(),
    gender:      String(w.gender || '').trim(),
    plural:      String(w.plural || '').trim(),
    conjugations: w.conjugations ? {
      ich: String(w.conjugations.ich || '').trim(),
      du:  String(w.conjugations.du  || '').trim(),
      er:  String(w.conjugations.er  || '').trim(),
      wir: String(w.conjugations.wir || '').trim(),
      ihr: String(w.conjugations.ihr || '').trim(),
      sie: String(w.conjugations.sie || '').trim(),
    } : undefined,
    comparative: String(w.comparative || '').trim(),
    superlative: String(w.superlative || '').trim(),
    example:     String(w.example || w.example_sentence || '').trim(),
    exampleEn:   String(w.example_en || w.exampleEn || '').trim(),
    sentences:   Array.isArray(w.sentences)
      ? w.sentences.map(s => String(s).trim()).filter(Boolean) : [],
    sentencesEn: Array.isArray(w.sentences_en)
      ? w.sentences_en.map(s => String(s).trim()).filter(Boolean) : [],
    tip:         String(w.tip || '').trim(),
  };
}

// ── Generate word set (batched) ───────────────────────────────────────────────
export const generateWordSet = async (req, res, next) => {
  try {
    const { category = 'mixed', count = 100 } = req.body;
    const safeCount = Math.min(Math.max(10, parseInt(count) || 100), 100);

    // Words this user has already seen
    const seenDocs = await Library.find(
      { userId: req.userId, partOfSpeech: category === 'mixed' ? { $exists: true } : category },
      'de'
    ).lean();
    const seenSet = new Set(seenDocs.map(d => keyOf(d.de)));

    const BATCH_SIZE = 12;
    const PER_WORD   = 420;
    const MAX_ATTEMPTS = 20;
    const DEADLINE = Date.now() + 50_000;
    const LETTERS = 'BEAGFHKLMNRSTUVWZDPO'.split('');

    const words = [];
    const usedInBatch = new Set();
    const recycled = [];            // previously-seen words, used only to top up
    let attempts = 0;

    while (words.length < safeCount && attempts < MAX_ATTEMPTS && Date.now() < DEADLINE) {
      const letter = LETTERS[attempts % LETTERS.length];
      attempts++;
      const n = Math.min(BATCH_SIZE, safeCount - words.length + 3);

      const exclude = [...usedInBatch].slice(-150);
      const exclusionHint = exclude.length
        ? `\n\nDo NOT include any of these words:\n${exclude.join(', ')}`
        : '';

      const prompt = (CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.mixed)
        .replace('{count}', n);

      let parsed;
      try {
        parsed = await callGroqJSON(
          `You are an expert German language teacher. Generate vocabulary lists with complete grammatical information.
Always respond with valid JSON only — a single object with a "words" array.`,
          `${prompt}

Return a JSON object: { "words": [ ...exactly ${n} word objects... ] }

Prefer common everyday words (A1-B1 level) that start with the letter "${letter}". If there are not enough, use other letters.
Do NOT repeat words.${exclusionHint}`,
          Math.min(8192, n * PER_WORD + 500)
        );
      } catch (e) {
        console.error(`[grammar] batch ${attempts} failed:`, e.message);
        continue;
      }

      const raw = parsed?.words || parsed;
      if (!Array.isArray(raw)) continue;

      for (const r of raw) {
        const w = normalizeWord(r, category);
        if (!w.de || !w.en) continue;
        const key = keyOf(w.de);
        if (usedInBatch.has(key)) continue;
        if (seenSet.has(key)) {          // already in library: keep as backup
          if (!recycled.find(x => keyOf(x.de) === key)) recycled.push(w);
          continue;
        }
        usedInBatch.add(key);
        words.push(w);
        if (words.length >= safeCount) break;
      }
    }

    // Top up with previously-seen words so the user always gets the count they asked for
    for (const w of recycled) {
      if (words.length >= safeCount) break;
      words.push(w);
    }

    console.log(`[grammar] requested ${safeCount}, produced ${words.length} (${recycled.length} recycled) in ${attempts} batches`);

    if (words.length === 0) {
      return res.status(200).json({
        wordSet: { words: [], category, count: 0 },
        allSeen: true,
        totalSeen: seenSet.size,
        message: 'No new words could be generated. Please try again.',
      });
    }

    const today = todayStr();
    await WordSet.deleteOne({ userId: req.userId, date: today, category });

    const wordSet = await WordSet.create({
      userId: req.userId, date: today, category, words,
    });

    await addWordsToLibrary(req.userId, words.map(w => ({
      ...w,
      source: 'grammar',
      partOfSpeech: w.category || category,
    }))).catch(() => {});

    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 5 } });

    const note = words.length < safeCount
      ? `Generated ${words.length} of ${safeCount} words. Generate again for more.`
      : undefined;

    res.json({ wordSet, totalSeen: seenSet.size + words.length, note });
  } catch (err) { next(err); }
};

// ── Tenses for ONE verb (used by the Tense page) ─────────────────────────────
const tenseCache = new Map();

export const generateVerbTenses = async (req, res, next) => {
  try {
    const verb = String(req.body.verb || '').trim();
    if (!verb) return res.status(400).json({ message: 'verb is required' });

    const cacheKey = verb.toLowerCase();
    if (tenseCache.has(cacheKey)) {
      return res.json({ verb, tenseExamples: tenseCache.get(cacheKey) });
    }

    const parsed = await callGroqJSON(
      'You are an expert German teacher. Respond with valid JSON only.',
      `For the German verb "${verb}" return:
{ "tense_examples": { "present": [...], "past": [...], "future": [...] } }
Each array has EXACTLY 7 objects in this order: ich, du, er, sie, es, wir, sie (plural "they").
Each object: {"pronoun": "...", "de": "a complete natural German sentence", "en": "English translation"}.
present = Präsens, past = Perfekt, future = Futur I with "werden".
Conjugate the verb correctly for every pronoun.`,
      3500
    );

    const tenseExamples = normalizeTenseExamples(parsed?.tense_examples || parsed);
    if (!tenseExamples) {
      return res.status(502).json({ message: 'AI returned no examples. Please try again.' });
    }

    tenseCache.set(cacheKey, tenseExamples);
    res.json({ verb, tenseExamples });
  } catch (err) { next(err); }
};

// ── Get today's set ────────────────────────────────────────────────────────────
export const getTodaySet = async (req, res, next) => {
  try {
    const { category = 'mixed' } = req.query;
    const wordSet = await WordSet.findOne({
      userId: req.userId, date: todayStr(), category,
    });
    res.json({ wordSet: wordSet || null });
  } catch (err) { next(err); }
};

// ── Mark as practiced ─────────────────────────────────────────────────────────
export const markPracticed = async (req, res, next) => {
  try {
    const { setId, score } = req.body;
    const wordSet = await WordSet.findOneAndUpdate(
      { _id: setId, userId: req.userId },
      { practiced: true, score },
      { new: true }
    );
    if (!wordSet) return res.status(404).json({ message: 'Word set not found' });

    if (score >= 70) {
      await User.findByIdAndUpdate(req.userId, {
        $inc: { totalXP: 25, wordsLearned: wordSet.words.length },
      });
    }
    res.json({ wordSet, score });
  } catch (err) { next(err); }
};

// ── History ────────────────────────────────────────────────────────────────────
export const getHistory = async (req, res, next) => {
  try {
    const history = await WordSet.find({ userId: req.userId })
      .select('date category score practiced createdAt')
      .sort({ createdAt: -1 })
      .limit(30);
    res.json({ history });
  } catch (err) { next(err); }
};
