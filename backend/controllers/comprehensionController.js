import { callGroqJSON } from '../config/groq.js';
import { addStoryToLibrary, getPastStoryTitles } from './libraryController.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

// ── Model ─────────────────────────────────────────────────────────────────────

const questionSchema = new mongoose.Schema({
  number:        { type: Number, required: true },
  type:          { type: String, enum: ['multiple_choice', 'true_false', 'short_answer'], required: true },
  question:      { type: String, required: true },
  options:       [String],                          // for multiple_choice + true_false
  correctAnswer: { type: String, required: true },  // 'A' | 'B' | 'C' | 'D' | 'True' | 'False' | text
  explanation:   { type: String, default: '' },
}, { _id: false });

const comprehensionSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  level:     { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1'], default: 'B1' },
  topic:     { type: String, default: 'daily life' },
  genre:     { type: String, default: 'story' },

  // The passage
  title:     { type: String, required: true },
  titleEn:   { type: String, default: '' },
  passage:   { type: String, required: true },   // full German text (paragraph form)
  passageEn: { type: String, default: '' },       // full English translation

  // Key vocabulary from the passage
  vocabulary: [{
    de: String, en: String, ipa: String, _id: false,
  }],

  // Questions
  questions:  [questionSchema],
  totalMarks: { type: Number, default: 10 },

  // Session result (filled after submission)
  answers:    [{ questionNumber: Number, given: String, correct: Boolean, _id: false }],
  score:      { type: Number },           // out of totalMarks
  percentage: { type: Number },
  feedback:   { type: String, default: '' },
  completed:  { type: Boolean, default: false },
}, { timestamps: true });

comprehensionSchema.index({ userId: 1, createdAt: -1 });
const Comprehension = mongoose.models.Comprehension ||
  mongoose.model('Comprehension', comprehensionSchema);

// ── Level config ──────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  A1: { words: '80-100',  sentences: 'very short (max 6 words), present tense only, most common 500 words', qCount: 5,  marks: 5  },
  A2: { words: '120-150', sentences: 'simple, max 10 words, present + simple past',                          qCount: 6,  marks: 6  },
  B1: { words: '180-220', sentences: 'medium complexity, varied tenses, subordinate clauses',                 qCount: 8,  marks: 8  },
  B2: { words: '250-300', sentences: 'complex sentences, idiomatic expressions, all tenses',                  qCount: 10, marks: 10 },
  C1: { words: '320-380', sentences: 'advanced, nuanced, near-native vocabulary and syntax',                  qCount: 10, marks: 10 },
};

const GENRE_LABELS = {
  story:       'a short narrative story',
  news:        'a news article',
  dialogue:    'a realistic conversation between two people',
  letter:      'a formal or informal letter',
  description: 'a descriptive text (place, person, or event)',
  opinion:     'an opinion/argumentative text',
};

// ── Generate passage + questions ───────────────────────────────────────────────

export const generateComprehension = async (req, res, next) => {
  try {
    const { level = 'B1', topic = 'daily life', genre = 'story' } = req.body;
    const cfg        = LEVEL_CONFIG[level] || LEVEL_CONFIG.B1;
    const genreLabel = GENRE_LABELS[genre] || GENRE_LABELS.story;

    // Deduplication: load past comprehension titles so AI avoids repeating them
    const pastStories = await getPastStoryTitles(req.userId);
    const exclusionHint = pastStories.length > 0
      ? `\n\nCRITICAL — Generate a COMPLETELY DIFFERENT passage. Do NOT reuse any of these titles or storylines the user has already seen:\n${pastStories.map(s => `"${s.title}" (${s.topic})`).slice(0, 50).join(', ')}`
      : '';

    const parsed = await callGroqJSON(
      `You are a certified German language examiner writing Goethe-style reading comprehension tests.
Always respond with valid JSON only — no markdown, no extra text outside the JSON object.`,

      `Create a ${level}-level German reading comprehension test.

PASSAGE:
- Genre: ${genreLabel}
- Topic: "${topic}"
- Length: ${cfg.words} words
- Language: ${cfg.sentences}
- Write as coherent paragraphs (not a list of sentences)
- Make it engaging and realistic

QUESTIONS:
Generate exactly ${cfg.qCount} comprehension questions based ONLY on information in the passage.
Mix these types:
- Multiple choice (4 options A/B/C/D) — most questions
- True/False — 1-2 questions  
- Short answer — 1-2 questions (answer is 1-4 words found directly in the text)

All questions must be answerable from the passage alone.
Questions must test different parts of the passage.
Wrong options (distractors) must be plausible but clearly wrong based on the text.

Return ONLY this JSON:
{
  "title": "Title in German",
  "title_en": "English translation of title",
  "passage": "Full German text as proper paragraphs separated by \\n\\n",
  "passage_en": "Full English translation of the passage",
  "vocabulary": [
    { "de": "word or phrase from passage", "en": "English meaning", "ipa": "[IPA]" }
  ],
  "questions": [
    {
      "number": 1,
      "type": "multiple_choice",
      "question": "Question in English",
      "options": ["A) option", "B) option", "C) option", "D) option"],
      "correctAnswer": "A",
      "explanation": "The text says '…' which means the answer is A"
    },
    {
      "number": 2,
      "type": "true_false",
      "question": "Statement in English — True or False?",
      "options": ["True", "False"],
      "correctAnswer": "True",
      "explanation": "The text states '…'"
    },
    {
      "number": 3,
      "type": "short_answer",
      "question": "What did X do? (Answer in 1-3 words from the text)",
      "options": [],
      "correctAnswer": "the exact word(s) from the passage in German or English as appropriate",
      "explanation": "The passage directly states '…'"
    }
  ],
  "totalMarks": ${cfg.marks}
}${exclusionHint}`
    );

    // Validate
    if (!parsed.passage || !Array.isArray(parsed.questions) || parsed.questions.length < 3) {
      return res.status(500).json({ message: 'Generation returned incomplete content. Please try again.' });
    }

    const vocabulary = (parsed.vocabulary || []).slice(0, 12).map(v => ({
      de:  String(v.de  || '').trim(),
      en:  String(v.en  || '').trim(),
      ipa: String(v.ipa || '').trim(),
    })).filter(v => v.de && v.en);

    const questions = parsed.questions.map((q, i) => ({
      number:        q.number || i + 1,
      type:          ['multiple_choice','true_false','short_answer'].includes(q.type) ? q.type : 'multiple_choice',
      question:      String(q.question      || '').trim(),
      options:       Array.isArray(q.options) ? q.options.map(o => String(o).trim()) : [],
      correctAnswer: String(q.correctAnswer || '').trim(),
      explanation:   String(q.explanation   || '').trim(),
    })).filter(q => q.question && q.correctAnswer);

    const doc = await Comprehension.create({
      userId:     req.userId,
      level, topic, genre,
      title:      String(parsed.title      || `${genre} — ${topic}`).trim(),
      titleEn:    String(parsed.title_en   || '').trim(),
      passage:    String(parsed.passage    || '').trim(),
      passageEn:  String(parsed.passage_en || '').trim(),
      vocabulary,
      questions,
      totalMarks: parsed.totalMarks || cfg.marks,
    });

    // Save to story library — deduplication ensures no title is stored twice
    await addStoryToLibrary(req.userId, {
      title:      doc.title,
      titleEn:    doc.titleEn,
      level:      doc.level,
      topic:      doc.topic,
      genre:      doc.genre,
      source:     'comprehension',
      passage:    doc.passage,
      passageEn:  doc.passageEn,
      vocabulary: doc.vocabulary,
      refId:      doc._id,
    }).catch(() => {});

    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 5 } });

    res.status(201).json({ comprehension: doc });
  } catch (err) { next(err); }
};

// ── Submit answers ─────────────────────────────────────────────────────────────

export const submitAnswers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { answers } = req.body;  // [{ questionNumber, given }]

    const doc = await Comprehension.findOne({ _id: id, userId: req.userId });
    if (!doc) return res.status(404).json({ message: 'Comprehension not found' });
    if (doc.completed) return res.status(400).json({ message: 'Already submitted' });

    // Grade answers
    let correct = 0;
    const graded = doc.questions.map(q => {
      const userAns = answers.find(a => a.questionNumber === q.number);
      const given   = (userAns?.given || '').trim();

      let isCorrect = false;
      if (q.type === 'short_answer') {
        // Flexible match — normalise both sides
        isCorrect = given.toLowerCase().includes(q.correctAnswer.toLowerCase()) ||
                    q.correctAnswer.toLowerCase().includes(given.toLowerCase());
      } else {
        // Multiple choice / true-false: first character match (A/B/C/D or True/False)
        isCorrect = given.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
      }

      if (isCorrect) correct++;
      return { questionNumber: q.number, given, correct: isCorrect };
    });

    const marksPerQ  = doc.totalMarks / doc.questions.length;
    const score      = Math.round(correct * marksPerQ * 10) / 10;
    const percentage = Math.round((correct / doc.questions.length) * 100);

    const feedback = percentage >= 80
      ? `Excellent! You scored ${score}/${doc.totalMarks} (${percentage}%). Outstanding comprehension.`
      : percentage >= 60
      ? `Good effort! You scored ${score}/${doc.totalMarks} (${percentage}%). Review the questions you missed.`
      : percentage >= 40
      ? `Keep practising! You scored ${score}/${doc.totalMarks} (${percentage}%). Re-read the passage and try again.`
      : `You scored ${score}/${doc.totalMarks} (${percentage}%). Read the passage carefully and focus on the key details.`;

    await Comprehension.findByIdAndUpdate(id, {
      answers: graded, score, percentage, feedback, completed: true,
    });

    if (percentage >= 60) {
      await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: percentage >= 80 ? 30 : 15 } });
    }

    res.json({ score, percentage, feedback, answers: graded, totalMarks: doc.totalMarks });
  } catch (err) { next(err); }
};

// ── Get single comprehension ───────────────────────────────────────────────────

export const getComprehension = async (req, res, next) => {
  try {
    const doc = await Comprehension.findOne({ _id: req.params.id, userId: req.userId });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json({ comprehension: doc });
  } catch (err) { next(err); }
};

// ── History ────────────────────────────────────────────────────────────────────

export const getHistory = async (req, res, next) => {
  try {
    const history = await Comprehension.find({ userId: req.userId })
      .select('title titleEn level genre topic score percentage totalMarks completed createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ history });
  } catch (err) { next(err); }
};

// ── Delete ─────────────────────────────────────────────────────────────────────

export const deleteComprehension = async (req, res, next) => {
  try {
    await Comprehension.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};
