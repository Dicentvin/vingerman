import { callGroqJSON } from '../config/groq.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

// ── Model ─────────────────────────────────────────────────────────────────────

const mockExamSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  level:   { type: String, enum: ['A1','A2','B1','B2','C1'], default: 'B1' },

  sections: {
    reading:  { type: mongoose.Schema.Types.Mixed },
    listening: { type: mongoose.Schema.Types.Mixed },
    writing:  { type: mongoose.Schema.Types.Mixed },
  },

  // Submitted answers + scores per section
  results: { type: mongoose.Schema.Types.Mixed, default: null },
  totalScore:   { type: Number },
  totalPercent: { type: Number },
  passed:       { type: Boolean },
  timeTaken:    { type: Number },   // seconds
  completed:    { type: Boolean, default: false },
}, { timestamps: true });

mockExamSchema.index({ userId: 1, createdAt: -1 });
const MockExam = mongoose.models.MockExam || mongoose.model('MockExam', mockExamSchema);

// ── Level config ──────────────────────────────────────────────────────────────

const LEVEL_CFG = {
  A1: { readingWords: '120-150', listeningWords: '80-100',  writingTask: 'Write a short personal introduction (40-50 words)', passPercent: 60 },
  A2: { readingWords: '180-220', listeningWords: '120-150', writingTask: 'Write a short email to a friend about your weekend (60-80 words)', passPercent: 60 },
  B1: { readingWords: '280-320', listeningWords: '200-240', writingTask: 'Write a semi-formal email responding to a job advertisement (80-100 words)', passPercent: 60 },
  B2: { readingWords: '350-400', listeningWords: '280-320', writingTask: 'Write an opinion essay about social media (120-150 words)', passPercent: 60 },
  C1: { readingWords: '420-480', listeningWords: '350-400', writingTask: 'Write a formal argumentative essay on the role of technology in education (150-200 words)', passPercent: 60 },
};

// ── Generate full mock exam ───────────────────────────────────────────────────

export const generateMockExam = async (req, res, next) => {
  try {
    const { level = 'B1' } = req.body;
    const cfg = LEVEL_CFG[level] || LEVEL_CFG.B1;

    const parsed = await callGroqJSON(
      `You are a certified Goethe-Institut exam writer. Generate realistic ${level}-level German exam content. Respond with valid JSON only.`,
      `Generate a complete ${level}-level German mock exam with three sections.

READING section:
- Write a German passage of ${cfg.readingWords} words on any everyday topic
- Write 5 comprehension questions in English with 4 multiple-choice options (A/B/C/D)
- All answers must come from the passage

LISTENING section (simulated):
- Write a German dialogue/monologue transcript of ${cfg.listeningWords} words (pretend it will be read aloud)
- Write 4 comprehension questions in English with True/False answers
- Label it as a listening transcript

WRITING section:
- Task: "${cfg.writingTask}"
- Provide a model answer in German
- Provide 4 marking criteria as short bullet points

Return ONLY this JSON:
{
  "reading": {
    "passage": "German text here",
    "questions": [
      {"number":1,"question":"English question","options":["A) opt","B) opt","C) opt","D) opt"],"correctAnswer":"A","explanation":"Because..."}
    ]
  },
  "listening": {
    "transcript": "German dialogue/monologue here",
    "questions": [
      {"number":1,"question":"English statement — True or False?","options":["True","False"],"correctAnswer":"True","explanation":"The text says..."}
    ]
  },
  "writing": {
    "task": "${cfg.writingTask}",
    "modelAnswer": "German model answer here",
    "markingCriteria": ["Content: addresses all points","Grammar: accurate structures","Vocabulary: appropriate range","Register: correct formality"]
  }
}`,
      7000
    );

    if (!parsed.reading?.passage || !parsed.listening?.transcript || !parsed.writing?.task) {
      return res.status(500).json({ message: 'Exam generation incomplete. Please try again.' });
    }

    const exam = await MockExam.create({
      userId: req.userId,
      level,
      sections: {
        reading:  parsed.reading,
        listening: parsed.listening,
        writing:  parsed.writing,
      },
    });

    res.status(201).json({ exam });
  } catch (err) {
    console.error('[mockExam] generate error:', err.message);
    next(err);
  }
};

// ── Submit exam ───────────────────────────────────────────────────────────────

export const submitMockExam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { answers, writingAnswer, timeTaken } = req.body;
    // answers: [{ section:'reading'|'listening', questionNumber, given }]

    const exam = await MockExam.findOne({ _id: id, userId: req.userId });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    if (exam.completed) return res.status(400).json({ message: 'Already submitted' });

    const cfg = LEVEL_CFG[exam.level] || LEVEL_CFG.B1;

    // Grade reading (5 MCQ × 2 marks = 10)
    const readingQs = exam.sections.reading?.questions || [];
    let readingCorrect = 0;
    const readingGraded = readingQs.map(q => {
      const ans = answers.find(a => a.section === 'reading' && a.questionNumber === q.number);
      const correct = (ans?.given || '').trim().toUpperCase() === q.correctAnswer.trim().toUpperCase();
      if (correct) readingCorrect++;
      return { questionNumber: q.number, given: ans?.given || '', correct };
    });
    const readingScore = readingCorrect * 2;  // out of 10

    // Grade listening (4 T/F × 2.5 marks = 10)
    const listeningQs = exam.sections.listening?.questions || [];
    let listeningCorrect = 0;
    const listeningGraded = listeningQs.map(q => {
      const ans = answers.find(a => a.section === 'listening' && a.questionNumber === q.number);
      const correct = (ans?.given || '').trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
      if (correct) listeningCorrect++;
      return { questionNumber: q.number, given: ans?.given || '', correct };
    });
    const listeningScore = Math.round(listeningCorrect * (10 / Math.max(listeningQs.length, 1)));

    // Writing: AI grades it (10 marks)
    let writingScore = 0;
    let writingFeedback = 'Writing not submitted.';
    if (writingAnswer?.trim()) {
      try {
        const wResult = await callGroqJSON(
          `You are a Goethe-Institut examiner. Grade the following ${exam.level}-level German writing task. Respond with valid JSON only.`,
          `Task: ${exam.sections.writing.task}

Student answer:
"${writingAnswer}"

Model answer for reference:
"${exam.sections.writing.modelAnswer}"

Grade out of 10 on: content (3), grammar (3), vocabulary (2), register (2).
Return JSON: { "score": 7, "breakdown": {"content":2,"grammar":3,"vocabulary":1,"register":1}, "feedback": "Short 2-sentence examiner feedback in English." }`,
          1000
        );
        writingScore = Math.min(10, Math.max(0, wResult.score || 0));
        writingFeedback = wResult.feedback || 'See breakdown above.';
      } catch {
        writingScore = 5;
        writingFeedback = 'Writing submitted — manual review recommended.';
      }
    }

    const totalScore   = readingScore + listeningScore + writingScore;   // out of 30
    const totalPercent = Math.round((totalScore / 30) * 100);
    const passed       = totalPercent >= cfg.passPercent;

    const results = {
      reading:  { graded: readingGraded,  score: readingScore,   outOf: 10 },
      listening:{ graded: listeningGraded,score: listeningScore, outOf: 10 },
      writing:  { answer: writingAnswer,  score: writingScore,   outOf: 10, feedback: writingFeedback },
    };

    await MockExam.findByIdAndUpdate(id, {
      results, totalScore, totalPercent, passed,
      timeTaken: timeTaken || 0, completed: true,
    });

    if (passed) await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: passed ? 50 : 20 } });

    res.json({ totalScore, totalPercent, passed, results, timeTaken });
  } catch (err) { next(err); }
};

// ── Get / History ─────────────────────────────────────────────────────────────

export const getMockExam = async (req, res, next) => {
  try {
    const exam = await MockExam.findOne({ _id: req.params.id, userId: req.userId });
    if (!exam) return res.status(404).json({ message: 'Not found' });
    res.json({ exam });
  } catch (err) { next(err); }
};

export const getMockExamHistory = async (req, res, next) => {
  try {
    const history = await MockExam.find({ userId: req.userId })
      .select('level totalScore totalPercent passed timeTaken completed createdAt')
      .sort({ createdAt: -1 }).limit(20).lean();
    res.json({ history });
  } catch (err) { next(err); }
};

export const deleteMockExam = async (req, res, next) => {
  try {
    await MockExam.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};
