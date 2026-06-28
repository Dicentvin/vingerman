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
- "sentences": array of 3-5 varied German sentences using this word in different contexts
- "sentences_en": English translations of each sentence in the same order
- "tip": memory trick for the gender (optional)`,

  verb: `Generate {count} German verbs (mix of regular and irregular).
For each word include:
- "de": infinitive form (e.g. "laufen")
- "en": English meaning
- "ipa": IPA pronunciation
- "category": "verb"
- "conjugations": object with keys ich/du/er/wir/ihr/sie present tense forms
- "example": example sentence using the verb
- "example_en": English translation
- "sentences": array of 3-5 varied German sentences using this verb in different tenses/contexts
- "sentences_en": English translations of each sentence in the same order
- "tip": note if irregular, separable, or takes sein in Perfekt`,

  adjective: `Generate {count} German adjectives.
For each word include:
- "de": base form of adjective
- "en": English meaning
- "ipa": IPA pronunciation
- "category": "adjective"
- "comparative": comparative form (e.g. "größer")
- "superlative": superlative form (e.g. "am größten")
- "example": example sentence with the adjective in use
- "example_en": English translation
- "sentences": array of 3-5 German sentences showing the adjective with different genders/cases
- "sentences_en": English translations of each sentence in the same order
- "tip": usage note or common pairing`,

  adverb: `Generate {count} German adverbs (time, manner, place, frequency).
For each word include:
- "de": the adverb
- "en": English meaning
- "ipa": IPA pronunciation
- "category": "adverb"
- "example": example sentence
- "example_en": English translation
- "sentences": array of 3-5 varied German sentences using this adverb
- "sentences_en": English translations of each sentence in the same order
- "tip": which type of adverb (time/manner/place/frequency)`,

  preposition: `Generate {count} German prepositions.
For each word include:
- "de": the preposition
- "en": English meaning(s)
- "ipa": IPA pronunciation
- "category": "preposition"
- "example": example sentence
- "example_en": English translation
- "sentences": array of 3-5 German sentences showing this preposition with correct cases
- "sentences_en": English translations of each sentence in the same order
- "tip": which case it takes (Accusative / Dative / Genitive / both)`,

  conjunction: `Generate {count} German conjunctions (coordinating and subordinating).
For each word include:
- "de": the conjunction
- "en": English equivalent
- "ipa": IPA pronunciation
- "category": "conjunction"
- "example": example sentence showing word order effect
- "example_en": English translation
- "sentences": array of 3-5 German sentences demonstrating this conjunction
- "sentences_en": English translations of each sentence in the same order
- "tip": coordinating or subordinating — and the word order rule`,

  pronoun: `Generate {count} German pronouns (personal, reflexive, relative, demonstrative).
For each word include:
- "de": the pronoun
- "en": English equivalent
- "ipa": IPA pronunciation
- "category": "pronoun"
- "example": example sentence
- "example_en": English translation
- "sentences": array of 3-5 German sentences showing this pronoun in use
- "sentences_en": English translations of each sentence in the same order
- "tip": type of pronoun and its case`,

  mixed: `Generate {count} useful German words — mix of nouns, verbs, adjectives, adverbs and prepositions.
For each word include ALL relevant fields:
- "de": word (nouns include article, e.g. "der Hund")
- "en": English meaning
- "ipa": IPA pronunciation
- "category": the actual category ("noun"|"verb"|"adjective"|"adverb"|"preposition"|"conjunction"|"pronoun")
- "gender": only for nouns
- "plural": only for nouns
- "conjugations": only for verbs (ich/du/er/wir/ihr/sie)
- "comparative"/"superlative": only for adjectives
- "example": example sentence
- "example_en": English translation
- "sentences": array of 3-5 varied German sentences using this word in real contexts
- "sentences_en": English translations of each sentence in the same order
- "tip": helpful memory note`,
};

// ── Generate word set ─────────────────────────────────────────────────────────
export const generateWordSet = async (req, res, next) => {
  try {
    const { category = 'mixed', count = 100 } = req.body;
    const safeCount = Math.min(Math.max(10, parseInt(count) || 100), 100);

    // ── Deduplication: load all words this user has ever seen for this category ──
    const seenDocs = await Library.find(
      { userId: req.userId, partOfSpeech: category === 'mixed' ? { $exists: true } : category },
      'de'
    ).lean();
    const seenSet = new Set(seenDocs.map(d => d.de.toLowerCase().replace(/^(der|die|das)\s+/i, '')));

    const exclusionHint = seenSet.size > 0
      ? `\n\nCRITICAL — do NOT include ANY of these words (user has already seen them):\n${[...seenSet].slice(0, 300).join(', ')}`
      : '';

    // Request extra words to compensate for AI duplication
    const requestCount = Math.min(safeCount + 20, 120);

    const promptTemplate = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.mixed;
    const prompt = promptTemplate.replace('{count}', requestCount);

    const parsed = await callGroqJSON(
      `You are an expert German language teacher. Generate vocabulary lists with complete grammatical information.
Always respond with valid JSON only — a single object with a "words" array.`,
      `${prompt}

Return a JSON object: { "words": [ ...array of ${requestCount} word objects... ] }

Make the words varied and genuinely useful for German learners.
Cover different difficulty levels — mix common everyday words with some intermediate ones.
Do NOT repeat words.${exclusionHint}`
    );

    const rawWords = parsed.words || parsed;
    if (!Array.isArray(rawWords) || rawWords.length === 0) {
      return res.status(500).json({ message: 'AI returned no words. Please try again.' });
    }

    // Normalise + deduplicate (against library AND within this batch)
    const usedInBatch = new Set();
    const words = rawWords.map(w => ({
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
      comparative:  String(w.comparative || '').trim(),
      superlative:  String(w.superlative || '').trim(),
      example:      String(w.example     || w.example_sentence || '').trim(),
      exampleEn:    String(w.example_en  || w.exampleEn || '').trim(),
      sentences:    Array.isArray(w.sentences)
        ? w.sentences.map(s => String(s).trim()).filter(Boolean)
        : [],
      sentencesEn:  Array.isArray(w.sentences_en)
        ? w.sentences_en.map(s => String(s).trim()).filter(Boolean)
        : [],
      tip:          String(w.tip || '').trim(),
    }))
    .filter(w => {
      if (!w.de || !w.en) return false;
      const key = w.de.toLowerCase().replace(/^(der|die|das)\s+/i, '');
      if (seenSet.has(key))        return false;  // already in library
      if (usedInBatch.has(key))    return false;  // duplicate within batch
      usedInBatch.add(key);
      return true;
    })
    .slice(0, safeCount);

    if (words.length === 0) {
      return res.status(200).json({
        wordSet: { words: [], category, count: 0 },
        allSeen: true,
        totalSeen: seenSet.size,
        message: 'You have seen all available words in this category! Your library is complete for now.',
      });
    }

    const today = todayStr();
    await WordSet.deleteOne({ userId: req.userId, date: today, category });

    const wordSet = await WordSet.create({
      userId: req.userId, date: today, category, words,
    });

    // Save new words to library — this IS the deduplication store going forward
    await addWordsToLibrary(req.userId, words.map(w => ({
      ...w,
      source: 'grammar',
      partOfSpeech: w.category || category,
    }))).catch(() => {});

    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 5 } });

    res.json({ wordSet, totalSeen: seenSet.size + words.length });
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
