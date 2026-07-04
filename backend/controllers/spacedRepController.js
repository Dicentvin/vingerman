import mongoose from 'mongoose';
import Library from '../models/Library.js';
import User from '../models/User.js';

const { ObjectId } = mongoose.Types;
function oid(id) { try { return new ObjectId(String(id)); } catch { return id; } }

// ── SM-2 Review Record ────────────────────────────────────────────────────────

const reviewSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  wordId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },

  // SM-2 fields
  interval:    { type: Number, default: 0 },    // days until next review
  repetitions: { type: Number, default: 0 },    // consecutive correct reviews
  easeFactor:  { type: Number, default: 2.5 },  // SM-2 ease factor (min 1.3)
  nextReview:  { type: Date,   default: Date.now },
  lastReview:  { type: Date },
  lastGrade:   { type: Number },                // 0-5

  // Stats
  totalReviews: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
}, { timestamps: true });

reviewSchema.index({ userId: 1, nextReview: 1 });
reviewSchema.index({ userId: 1, wordId: 1 }, { unique: true });
const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

// ── SM-2 algorithm ────────────────────────────────────────────────────────────
// grade: 0 = blackout, 1 = wrong, 2 = wrong but remembered, 3 = correct hard, 4 = correct, 5 = perfect

function sm2(r, grade) {
  const g = Math.max(0, Math.min(5, grade));

  // New ease factor
  const ef = Math.max(1.3, r.easeFactor + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02)));

  let reps = r.repetitions;
  let interval = r.interval;

  if (g < 3) {
    // Failed — reset
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    if (reps === 1)      interval = 1;
    else if (reps === 2) interval = 6;
    else                 interval = Math.round(r.interval * ef);
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return { interval, repetitions: reps, easeFactor: ef, nextReview };
}

// ── GET /api/spaced-rep/queue — today's due words ─────────────────────────────

export const getQueue = async (req, res, next) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit || '20'));
    const now   = new Date();

    // Words due for review
    const dueReviews = await Review.find({
      userId:     oid(req.userId),
      nextReview: { $lte: now },
    })
    .sort({ nextReview: 1 })
    .limit(limit)
    .lean();

    // New words from library not yet in the review queue (up to fill limit)
    const reviewedIds = dueReviews.map(r => r.wordId);
    const allReviewedIds = await Review.find({ userId: oid(req.userId) }, 'wordId').lean();
    const allReviewedWordIds = allReviewedIds.map(r => r.wordId);

    const remaining = limit - dueReviews.length;
    let newWords = [];
    if (remaining > 0) {
      newWords = await Library.find({
        userId: oid(req.userId),
        _id:    { $nin: allReviewedWordIds },
      })
      .sort({ createdAt: 1 })  // oldest first
      .limit(remaining)
      .lean();
    }

    // Hydrate due reviews with word data
    const wordIds = dueReviews.map(r => r.wordId);
    const words   = await Library.find({ _id: { $in: wordIds } }).lean();
    const wordMap = Object.fromEntries(words.map(w => [w._id.toString(), w]));

    const queue = [
      // Due reviews
      ...dueReviews.map(r => ({
        reviewId:    r._id,
        wordId:      r.wordId,
        word:        wordMap[r.wordId.toString()] || null,
        isNew:       false,
        interval:    r.interval,
        repetitions: r.repetitions,
        easeFactor:  r.easeFactor,
        lastGrade:   r.lastGrade,
      })).filter(q => q.word),
      // New words
      ...newWords.map(w => ({
        reviewId:    null,
        wordId:      w._id,
        word:        w,
        isNew:       true,
        interval:    0,
        repetitions: 0,
        easeFactor:  2.5,
        lastGrade:   null,
      })),
    ];

    // Stats
    const totalDue    = await Review.countDocuments({ userId: oid(req.userId), nextReview: { $lte: now } });
    const totalLearned = await Review.countDocuments({ userId: oid(req.userId) });
    const totalNew    = await Library.countDocuments({ userId: oid(req.userId), _id: { $nin: allReviewedWordIds } });

    res.json({ queue, stats: { totalDue, totalLearned, totalNew } });
  } catch (err) { next(err); }
};

// ── POST /api/spaced-rep/review — submit a grade for one word ─────────────────

export const submitReview = async (req, res, next) => {
  try {
    const { wordId, grade } = req.body;
    const g = Math.max(0, Math.min(5, parseInt(grade)));

    let review = await Review.findOne({ userId: oid(req.userId), wordId: oid(wordId) });

    if (!review) {
      // First time seeing this word
      review = new Review({ userId: oid(req.userId), wordId: oid(wordId) });
    }

    const updated = sm2(review, g);
    review.interval     = updated.interval;
    review.repetitions  = updated.repetitions;
    review.easeFactor   = updated.easeFactor;
    review.nextReview   = updated.nextReview;
    review.lastReview   = new Date();
    review.lastGrade    = g;
    review.totalReviews += 1;
    if (g >= 3) review.correctCount += 1;

    await review.save();

    if (g >= 3) await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 2 } });

    res.json({
      nextReview:  updated.nextReview,
      interval:    updated.interval,
      repetitions: updated.repetitions,
      easeFactor:  updated.easeFactor,
    });
  } catch (err) { next(err); }
};

// ── GET /api/spaced-rep/stats ─────────────────────────────────────────────────

export const getStats = async (req, res, next) => {
  try {
    const now  = new Date();
    const [due, learned, mastered] = await Promise.all([
      Review.countDocuments({ userId: oid(req.userId), nextReview: { $lte: now } }),
      Review.countDocuments({ userId: oid(req.userId) }),
      Review.countDocuments({ userId: oid(req.userId), repetitions: { $gte: 5 }, interval: { $gte: 21 } }),
    ]);
    const totalInLibrary = await Library.countDocuments({ userId: oid(req.userId) });
    res.json({ due, learned, mastered, totalInLibrary, unstarted: Math.max(0, totalInLibrary - learned) });
  } catch (err) { next(err); }
};
