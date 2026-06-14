import { callGroqJSON } from '../config/groq.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

// ── Models ────────────────────────────────────────────────────────────────────

const seenWordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic:  { type: String, required: true },
  word:   { type: String, required: true },
}, { timestamps: true });

seenWordSchema.index({ userId: 1, topic: 1, word: 1 }, { unique: true });
const SeenWord = mongoose.models.SeenWord || mongoose.model('SeenWord', seenWordSchema);

const articleSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic:  { type: String, default: 'mixed' },
  count:  { type: Number, default: 20 },
  score:  { type: Number },
  date:   { type: String },
}, { timestamps: true });

const ArticleSession = mongoose.models.ArticleSession ||
  mongoose.model('ArticleSession', articleSessionSchema);

const TOPIC_DESCS = {
  mixed:       'all categories — animals, food, household, body parts, nature, transport, professions, clothes, school',
  animals:     'animals (Tiere)',
  food:        'food and drink (Essen und Trinken)',
  body:        'body parts (Körperteile)',
  household:   'household items (Haushaltsgegenstände)',
  clothes:     'clothing items (Kleidung)',
  nature:      'nature and environment (Natur)',
  transport:   'transport and vehicles (Verkehrsmittel)',
  professions: 'professions and jobs (Berufe)',
  school:      'school and education (Schule)',
};

// ── Generate with deduplication ───────────────────────────────────────────────

export const generateArticleSet = async (req, res, next) => {
  try {
    const { topic = 'mixed', count = 20 } = req.body;
    const safeCount = Math.min(Math.max(5, parseInt(count) || 20), 50);

    // Load all words this user has already seen for this topic
    const seenDocs = await SeenWord.find({ userId: req.userId, topic }).select('word').lean();
    const seenSet  = new Set(seenDocs.map(d => d.word.toLowerCase()));

    // Tell AI to exclude already-seen words
    const exclusionHint = seenSet.size > 0
      ? `\n\nCRITICAL — do NOT include ANY of these words (user has already seen them):\n${[...seenSet].slice(0, 200).join(', ')}`
      : '';

    // Request extra to survive duplicates inside AI response
    const requestCount = Math.min(safeCount + 15, 60);

    const parsed = await callGroqJSON(
      `You are an expert German teacher. Always respond with valid JSON only — no markdown.`,
      `Generate ${requestCount} UNIQUE German nouns from: ${TOPIC_DESCS[topic] || TOPIC_DESCS.mixed}.

Each word object must have:
- "de": noun WITHOUT article (e.g. "Hund")
- "en": English meaning
- "gender": exactly "der", "die", or "das"
- "plural": plural WITH article (e.g. "die Hunde")
- "ipa": IPA pronunciation of the noun only
- "category": brief category label (e.g. "animal")
- "tip": a memory tip for this gender (max 80 chars)
- "example": a natural German sentence using the noun with its correct article
- "example_en": English translation of the example

Return JSON object: { "words": [ ...array of ${requestCount} objects... ] }

STRICT rules:
- Every noun must be COMPLETELY DIFFERENT from each other
- Balanced mix of der/die/das genders
- Common useful words for A1-B1 learners
- Helpful gender memory tips${exclusionHint}`
    );

    const raw = Array.isArray(parsed) ? parsed : (parsed.words || []);
    if (!raw || raw.length === 0) {
      return res.status(500).json({ message: 'AI returned no words. Please try again.' });
    }

    // Deduplicate: filter seen + within-response duplicates
    const usedInResponse = new Set();
    const words = raw
      .map(w => ({
        de:        String(w.de           || '').trim(),
        en:        String(w.en           || '').trim(),
        gender:    ['der','die','das'].includes(String(w.gender).toLowerCase())
                     ? String(w.gender).toLowerCase() : 'der',
        plural:    String(w.plural       || '').trim(),
        ipa:       String(w.ipa          || '').trim(),
        category:  String(w.category     || topic).trim(),
        tip:       String(w.tip          || '').trim(),
        example:   String(w.example      || '').trim(),
        exampleEn: String(w.example_en   || w.exampleEn || '').trim(),
      }))
      .filter(w => {
        if (!w.de || !w.en) return false;
        const key = w.de.toLowerCase();
        if (seenSet.has(key))          return false;  // already seen ever
        if (usedInResponse.has(key))   return false;  // duplicate in this batch
        usedInResponse.add(key);
        return true;
      })
      .slice(0, safeCount);

    if (words.length === 0) {
      return res.status(200).json({
        wordSet: { words: [], topic, count: 0 },
        allSeen: true,
        totalSeen: seenSet.size,
        message: 'You have seen all available words in this category! Use the reset button to start fresh.',
      });
    }

    // Mark new words as seen
    if (words.length > 0) {
      await Promise.all(words.map(w =>
        SeenWord.updateOne(
          { userId: req.userId, topic, word: w.de.toLowerCase() },
          { $setOnInsert: { userId: req.userId, topic, word: w.de.toLowerCase() } },
          { upsert: true }
        ).catch(() => {})   // ignore duplicate key errors
      ));
    }

    res.json({
      wordSet: { words, topic, count: words.length },
      totalSeen: seenSet.size + words.length,
    });
  } catch (err) {
    console.error('[articleController] generateArticleSet error:', err.message);
    next(err);
  }
};

// ── Save result ───────────────────────────────────────────────────────────────

export const savePracticed = async (req, res, next) => {
  try {
    const { topic, count, score } = req.body;
    const date = new Date().toISOString().split('T')[0];
    await ArticleSession.create({ userId: req.userId, topic, count, score, date });
    if (score >= 70) {
      await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 15 } });
    }
    res.json({ message: 'Session saved' });
  } catch (err) { next(err); }
};

// ── Reset seen words for topic ────────────────────────────────────────────────

export const resetSeen = async (req, res, next) => {
  try {
    const { topic } = req.params;
    const result = await SeenWord.deleteMany({ userId: req.userId, topic });
    res.json({ message: `Reset ${result.deletedCount} seen words for "${topic}"` });
  } catch (err) { next(err); }
};

// ── History + seen counts ─────────────────────────────────────────────────────

export const getHistory = async (req, res, next) => {
  try {
    const history = await ArticleSession.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(20)
      .select('topic count score date createdAt')
      .lean();

    // Safe ObjectId conversion — handles both string and ObjectId
    let seenByTopic = {};
    try {
      const userObjId = new mongoose.Types.ObjectId(String(req.userId));
      const seenCounts = await SeenWord.aggregate([
        { $match: { userId: userObjId } },
        { $group: { _id: '$topic', count: { $sum: 1 } } },
      ]);
      seenByTopic = Object.fromEntries(seenCounts.map(s => [s._id, s.count]));
    } catch (e) {
      console.warn('[articleController] seenByTopic aggregation failed:', e.message);
    }

    res.json({ history, seenByTopic });
  } catch (err) { next(err); }
};
