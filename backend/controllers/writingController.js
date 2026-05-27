import { callGroqJSON } from '../config/groq.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// ── Inline model ──────────────────────────────────────────────────────────────
const writingSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  original:  { type: String, required: true },
  corrected: { type: String, required: true },
  score:     { type: Number },
  diffs:     [{
    original: String, corrected: String,
    type: { type: String }, explanation: String,
    _id: false,
  }],
  summary:        { type: String },
  encouragement:  { type: String },
}, { timestamps: true });

const Writing = mongoose.models.Writing || mongoose.model('Writing', writingSchema);

// ── Controller ────────────────────────────────────────────────────────────────
export const correctWriting = async (req, res, next) => {
  try {
    const { text, level = 'B1' } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'Text is required' });

    const parsed = await callGroqJSON(
      `You are an expert German grammar teacher. Respond with valid JSON only.`,
      `Correct this German text written by a ${level} level learner:

"${text}"

Return a JSON object:
{
  "corrected": "the fully corrected German sentence",
  "score": 85,
  "summary": "One-line overall assessment (max 80 chars)",
  "encouragement": "Warm, motivational closing message (max 100 chars)",
  "diffs": [
    {
      "original": "the incorrect word/phrase from the original",
      "corrected": "the correct version",
      "type": "grammar|gender|case|word-order|spelling|vocabulary",
      "explanation": "Brief English explanation of why this is wrong and the rule (max 120 chars)"
    }
  ]
}

Rules:
- score: 0-100 reflecting correctness (100 = perfect)
- diffs: list EVERY error found; empty array [] if no errors
- type must be one of: grammar, gender, case, word-order, spelling, vocabulary
- Keep explanations concise and educational
- encouragement should match the score — celebrate high scores, be warm for low ones`
    );

    const correction = {
      original:      text,
      corrected:     String(parsed.corrected || text).trim(),
      score:         Math.min(100, Math.max(0, parseInt(parsed.score) || 50)),
      diffs:         (parsed.diffs || []).map((d: Record<string, string>) => ({
        original:    String(d.original || '').trim(),
        corrected:   String(d.corrected || '').trim(),
        type:        String(d.type || 'grammar'),
        explanation: String(d.explanation || '').trim(),
      })).filter((d: {original: string}) => d.original),
      summary:       String(parsed.summary || '').trim(),
      encouragement: String(parsed.encouragement || 'Keep practising — you\'re improving!').trim(),
    };

    await Writing.create({ userId: req.userId, ...correction });
    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 10 } });

    res.json({ correction });
  } catch (err) { next(err); }
};

export const getWritingHistory = async (req, res, next) => {
  try {
    const history = await Writing.find({ userId: req.userId })
      .select('original corrected score createdAt')
      .sort({ createdAt: -1 }).limit(20);
    res.json({ history });
  } catch (err) { next(err); }
};
