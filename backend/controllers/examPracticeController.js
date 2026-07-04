import { callGroqJSON, callGroq } from '../config/groq.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

// ── Model ─────────────────────────────────────────────────────────────────────
const examAttemptSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  level:     { type: String, enum: ['A1', 'A2'] },
  skill:     { type: String, enum: ['horen', 'lesen', 'schreiben', 'sprechen'] },
  topic:     { type: String },
  question:  { type: String },
  userAnswer:{ type: String },
  score:     { type: Number },
  feedback:  { type: String },
}, { timestamps: true });

const ExamAttempt = mongoose.models.ExamAttempt ||
  mongoose.model('ExamAttempt', examAttemptSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────
const LEVEL_GUIDES = {
  A1: 'Very basic German — short sentences, present tense, most common 500 words only.',
  A2: 'Elementary German — simple past/perfect, common vocabulary, short texts up to 80 words.',
};

// ── Generate exam-style question ──────────────────────────────────────────────
export const generateQuestion = async (req, res, next) => {
  try {
    const { level = 'A1', skill = 'lesen', topic = 'daily life' } = req.body;
    const levelGuide = LEVEL_GUIDES[level] || LEVEL_GUIDES.A1;

    const skillPrompts = {
      lesen: `Create a Goethe-Zertifikat ${level} style LESEN (reading) exercise.
Level: ${levelGuide}
Topic: ${topic}

Return JSON:
{
  "instruction": "Read the text and answer the question (in English, as given in real exam).",
  "text": "A short German text (4-6 sentences, ${level} level) about ${topic}",
  "question": "One comprehension question in English",
  "options": ["A) correct answer", "B) wrong option", "C) wrong option"],
  "correctOption": "A",
  "explanation": "Why A is correct — what in the text proves it"
}`,

      schreiben: `Create a Goethe-Zertifikat ${level} style SCHREIBEN (writing) exercise.
Level: ${levelGuide}
Topic: ${topic}

Return JSON:
{
  "instruction": "Write a short message/reply in German (25-40 words for A1, 50-70 words for A2).",
  "prompt": "The situation/task the student must write about (in English)",
  "keyPoints": ["Point 1 they must mention", "Point 2", "Point 3"],
  "sampleAnswer": "A model answer in German at ${level} level",
  "sampleAnswerTranslation": "English translation of the model answer",
  "gradingCriteria": "What earns full marks: content, grammar, vocabulary"
}`,

      horen: `Create a Goethe-Zertifikat ${level} style HÖREN (listening) exercise.
Since we can't play audio, create a transcript the student reads, then answers questions.
Level: ${levelGuide}
Topic: ${topic}

Return JSON:
{
  "instruction": "Read this dialogue/announcement carefully and answer the question.",
  "transcript": "A short spoken German text (dialogue or announcement, 4-6 lines, ${level} level)",
  "speakers": "Who is speaking (e.g. 'A shop assistant and a customer')",
  "question": "One comprehension question in English",
  "options": ["A) correct answer", "B) wrong option", "C) wrong option"],
  "correctOption": "A",
  "explanation": "Why A is correct based on the transcript"
}`,

      sprechen: `Create a Goethe-Zertifikat ${level} style SPRECHEN (speaking) exercise.
Level: ${levelGuide}
Topic: ${topic}

Return JSON:
{
  "instruction": "Speak for 30-60 seconds on this topic. You can also use this for writing practice.",
  "task": "The speaking task (e.g. 'Describe your daily routine' or 'Ask your partner about their weekend')",
  "type": "monologue or dialogue",
  "promptQuestions": ["Question 1 to address", "Question 2", "Question 3"],
  "usefulPhrases": ["Phrase 1 in German", "Phrase 2", "Phrase 3", "Phrase 4"],
  "sampleAnswer": "A model spoken response in German at ${level} level (3-5 sentences)",
  "sampleAnswerTranslation": "English translation"
}`
    };

    const parsed = await callGroqJSON(
      `You are a certified Goethe-Institut exam writer. Create authentic ${level} exam exercises.
Always respond with valid JSON only.`,
      skillPrompts[skill] || skillPrompts.lesen
    );

    res.json({ question: { ...parsed, skill, level, topic } });
  } catch (err) { next(err); }
};

// ── Grade a writing answer ─────────────────────────────────────────────────────
export const gradeAnswer = async (req, res, next) => {
  try {
    const { level = 'A1', skill, topic, question, userAnswer } = req.body;
    if (!userAnswer?.trim()) return res.status(400).json({ message: 'Answer required' });

    const levelGuide = LEVEL_GUIDES[level] || LEVEL_GUIDES.A1;

    const feedback = await callGroq(
      `You are a strict but encouraging Goethe-Institut examiner grading a ${level} ${skill} exercise.
${levelGuide}`,
      `Task/Question: ${question}
Student's answer: "${userAnswer}"

Grade this answer out of 100 and provide:
1. ✅ What was done well (be specific)
2. ❌ Main errors found (grammar, vocabulary, content)
3. 💡 How to improve
4. 📝 Corrected version of their answer
5. 🎯 Score: X/100 — [Pass/Near Pass/Needs Work]

Be encouraging but honest. Remember this is ${level} level.`
    );

    const scoreMatch = feedback.match(/(\d+)\s*\/\s*100/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;

    await ExamAttempt.create({
      userId: req.userId, level, skill, topic,
      question, userAnswer, score, feedback,
    });

    if (score >= 60) {
      await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 20 } });
    }

    res.json({ feedback, score });
  } catch (err) { next(err); }
};

// ── Get practice history ──────────────────────────────────────────────────────
export const getHistory = async (req, res, next) => {
  try {
    const { level } = req.query;
    const filter = { userId: req.userId };
    if (level) filter.level = level;

    const history = await ExamAttempt.find(filter)
      .sort({ createdAt: -1 }).limit(20)
      .select('level skill topic score createdAt');

    const avgBySkill = ['horen', 'lesen', 'schreiben', 'sprechen'].map(skill => {
      const attempts = history.filter(h => h.skill === skill);
      return {
        skill,
        count: attempts.length,
        avg: attempts.length
          ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / attempts.length)
          : 0,
      };
    });

    res.json({ history, avgBySkill });
  } catch (err) { next(err); }
};
