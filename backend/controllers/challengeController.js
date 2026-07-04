import { callGroqJSON } from '../config/groq.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

const challengeSchema = new mongoose.Schema({
  date:       { type: String, required: true, unique: true }, // YYYY-MM-DD
  type:       { type: String },
  question:   { type: String },
  answer:     { type: String },
  options:    [String],
  hint:       { type: String },
  xpReward:   { type: Number, default: 50 },
  explanation:{ type: String },
}, { timestamps: true });

const submissionSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge' },
  date:        { type: String },
  answer:      { type: String },
  score:       { type: Number },
  correct:     { type: Boolean },
}, { timestamps: true });

submissionSchema.index({ userId: 1, date: 1 }, { unique: true });

const Challenge   = mongoose.models.Challenge   || mongoose.model('Challenge',   challengeSchema);
const Submission  = mongoose.models.Submission  || mongoose.model('Submission',  submissionSchema);

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

async function generateChallenge(dateStr) {
  const types = ['translate', 'fill-blank', 'multiple-choice'];
  const type  = types[Math.floor(Math.random() * types.length)];

  const prompts = {
    translate: `Create a German learning challenge of type "translate". 
Return JSON: {"type":"translate","question":"Translate this to German: [an English sentence about daily life]","answer":"the correct German translation","hint":"first letter hint","xpReward":50,"explanation":"brief grammar tip about this sentence"}`,
    'fill-blank': `Create a German "fill-blank" challenge with one missing word marked as ___.
Return JSON: {"type":"fill-blank","question":"Fill in: [German sentence with ___ for missing word]","answer":"the missing German word","hint":"the word means [English meaning]","xpReward":40,"explanation":"why this word fits here"}`,
    'multiple-choice': `Create a German multiple-choice vocabulary question.
Return JSON: {"type":"multiple-choice","question":"What does '[German word]' mean?","answer":"correct English meaning","options":["correct answer","wrong1","wrong2","wrong3"],"xpReward":30,"explanation":"memory tip for this word"}`,
  };

  const parsed = await callGroqJSON(
    `You are a German language challenge creator. Return valid JSON only.`,
    prompts[type]
  );

  return Challenge.create({
    date: dateStr, type: parsed.type || type,
    question: parsed.question, answer: parsed.answer,
    options: parsed.options || [],
    hint: parsed.hint || '', xpReward: parsed.xpReward || 50,
    explanation: parsed.explanation || '',
  });
}

export const getTodayChallenge = async (req, res, next) => {
  try {
    const today = todayStr();
    let challenge = await Challenge.findOne({ date: today });
    if (!challenge) challenge = await generateChallenge(today);

    const submission = await Submission.findOne({ userId: req.userId, date: today });

    res.json({
      challenge: {
        ...challenge.toObject(),
        completed:  !!submission,
        userAnswer: submission?.answer,
        score:      submission?.score,
      },
    });
  } catch (err) { next(err); }
};

export const submitChallenge = async (req, res, next) => {
  try {
    const { challengeId, answer } = req.body;
    const today = todayStr();

    const existing = await Submission.findOne({ userId: req.userId, date: today });
    if (existing) return res.status(400).json({ message: 'Already submitted today\'s challenge' });

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return res.status(404).json({ message: 'Challenge not found' });

    // Score the answer
    const normalize = (s = '') => s.toLowerCase().replace(/[^a-zäöüß\s]/g, '').trim();
    const correct = normalize(answer) === normalize(challenge.answer);
    const score   = correct ? 100 :
      normalize(answer).includes(normalize(challenge.answer).split(' ')[0]) ? 50 : 20;

    await Submission.create({
      userId: req.userId, challengeId, date: today,
      answer, score, correct,
    });

    if (score > 0) {
      const xp = Math.round(challenge.xpReward * score / 100);
      await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: xp } });
    }

    res.json({
      result: { correct, score, explanation: challenge.explanation },
      userAnswer: answer,
    });
  } catch (err) { next(err); }
};

export const getLeaderboard = async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('name totalXP streak')
      .sort({ totalXP: -1 })
      .limit(10);

    const leaderboard = users.map((u, i) => ({
      userId: u._id.toString(),
      name:   u.name,
      xp:     u.totalXP,
      streak: u.streak,
      rank:   i + 1,
    }));

    const userEntry = leaderboard.find(e => e.userId === req.userId?.toString());
    let userRank = userEntry?.rank ?? null;

    if (!userRank) {
      const count = await User.countDocuments({ totalXP: { $gt: (await User.findById(req.userId))?.totalXP || 0 } });
      userRank = count + 1;
    }

    res.json({ leaderboard, userRank });
  } catch (err) { next(err); }
};
