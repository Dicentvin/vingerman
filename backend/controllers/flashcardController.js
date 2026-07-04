import mongoose from 'mongoose';
import VocabList from '../models/VocabList.js';
import User from '../models/User.js';

// ── Flashcard model ───────────────────────────────────────────────────────────
const flashcardSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  wordId:      { type: String, required: true },   // VocabWord subdoc _id
  listId:      { type: mongoose.Schema.Types.ObjectId, ref: 'VocabList' },
  topic:       { type: String, default: '' },
  de:          { type: String, required: true },
  en:          { type: String, required: true },
  ipa:         { type: String, default: '' },
  example:     { type: String, default: '' },
  exampleEn:   { type: String, default: '' },
  // SM-2 SRS fields
  interval:    { type: Number, default: 1 },
  easeFactor:  { type: Number, default: 2.5 },
  repetitions: { type: Number, default: 0 },
  dueDate:     { type: Date, default: Date.now },
  lastRating:  { type: String },
}, { timestamps: true });

flashcardSchema.index({ userId: 1, dueDate: 1 });
flashcardSchema.index({ userId: 1, wordId: 1 }, { unique: true });

const Flashcard = mongoose.models.Flashcard || mongoose.model('Flashcard', flashcardSchema);

// ── SM-2 algorithm ─────────────────────────────────────────────────────────────
function sm2(card, rating) {
  const q = { again: 0, hard: 2, good: 4, easy: 5 }[rating] ?? 3;
  let { easeFactor, interval, repetitions } = card;

  if (q < 3) {
    repetitions = 0;
    interval    = 1;
  } else {
    if (repetitions === 0)      interval = 1;
    else if (repetitions === 1) interval = 6;
    else                        interval = Math.round(interval * easeFactor);
    repetitions++;
  }
  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  interval   = rating === 'easy' ? Math.round(interval * 1.3) : interval;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + interval);
  return { interval, easeFactor, repetitions, dueDate };
}

// ── Controllers ───────────────────────────────────────────────────────────────
export const getDueCards = async (req, res, next) => {
  try {
    const now   = new Date();
    const cards = await Flashcard.find({ userId: req.userId, dueDate: { $lte: now } })
      .sort({ dueDate: 1 }).limit(30);
    res.json({ cards });
  } catch (err) { next(err); }
};

export const rateCard = async (req, res, next) => {
  try {
    const { cardId, rating } = req.body;
    if (!['again','hard','good','easy'].includes(rating))
      return res.status(400).json({ message: 'Invalid rating' });

    const card = await Flashcard.findOne({ _id: cardId, userId: req.userId });
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const updates = sm2(card, rating);
    Object.assign(card, updates, { lastRating: rating });
    await card.save();

    if (rating === 'good' || rating === 'easy') {
      await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 2, wordsLearned: 0 } });
    }
    res.json({ card });
  } catch (err) { next(err); }
};

export const syncFromVocab = async (req, res, next) => {
  try {
    const lists = await VocabList.find({ userId: req.userId });
    let created = 0;

    for (const list of lists) {
      for (const word of list.words) {
        try {
          await Flashcard.updateOne(
            { userId: req.userId, wordId: word._id.toString() },
            {
              $setOnInsert: {
                userId: req.userId, wordId: word._id.toString(),
                listId: list._id, topic: list.topic,
                de: word.de, en: word.en,
                ipa: word.ipa || '', example: word.example || '',
                exampleEn: word.exampleEn || '',
                interval: 1, easeFactor: 2.5, repetitions: 0,
                dueDate: new Date(), lastRating: null,
              }
            },
            { upsert: true }
          );
          created++;
        } catch { /* duplicate — skip */ }
      }
    }

    const cards = await Flashcard.find({ userId: req.userId });
    res.json({ synced: created, cards });
  } catch (err) { next(err); }
};
