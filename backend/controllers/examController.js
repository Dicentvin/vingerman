import { callGroq, callGroqJSON } from '../config/groq.js';
import ExamSession from '../models/ExamSession.js';
import User from '../models/User.js';

// ── Generate a practice exam ─────────────────────────────────────────────────
export const generateExam = async (req, res, next) => {
  try {
    const { examLevel = 'A1', section = 'vocabulary', questionCount = 10 } = req.body;

    const sectionPrompts = {
      vocabulary: `Generate ${questionCount} multiple-choice vocabulary questions for the Goethe-Zertifikat ${examLevel} exam.
Each question tests ONE German word/phrase. Mix word meanings, usage, and context.`,
      grammar: `Generate ${questionCount} multiple-choice grammar questions for Goethe-Zertifikat ${examLevel}.
Test: articles, cases, verb conjugation, sentence structure, prepositions appropriate for ${examLevel}.`,
      reading: `Generate ${questionCount} reading comprehension questions for Goethe-Zertifikat ${examLevel}.
Create a short German text (3-5 sentences) then ask comprehension questions about it.`,
      writing: `Generate ${questionCount} fill-in-the-blank or short answer writing questions for Goethe-Zertifikat ${examLevel}.
Test: sentence completion, word forms, connecting sentences.`,
      listening: `Generate ${questionCount} listening comprehension questions for Goethe-Zertifikat ${examLevel}.
Create a German dialogue/announcement transcript, then comprehension questions.`,
      speaking: `Generate ${questionCount} speaking prompt questions for Goethe-Zertifikat ${examLevel}.
These are open-ended prompts the student will answer aloud.`,
      full: `Generate a balanced ${questionCount}-question mixed exam for Goethe-Zertifikat ${examLevel}.
Mix: vocabulary (30%), grammar (30%), reading comprehension (20%), writing (20%).`,
    };

    const systemPrompt = `You are an official Goethe-Institut exam creator. 
You generate authentic practice questions that match the exact format, difficulty, and topic coverage of the official Goethe-Zertifikat exams.
You ONLY respond with valid JSON.`;

    const userPrompt = `${sectionPrompts[section] || sectionPrompts.vocabulary}

Return a JSON object with a "questions" array. Each question:
{
  "type": "mcq" | "fill" | "translate" | "speaking",
  "question": "The question text (in German when appropriate for level)",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],  // only for mcq type
  "correctAnswer": "The correct answer",
  "explanation": "Why this is correct (always in English for clarity)"
}

For speaking type: options should be empty array, correctAnswer should be a model answer.
Ensure difficulty matches ${examLevel} (A1=beginner, A2=elementary, B1=intermediate, B2=upper-intermediate, C1=advanced, C2=mastery).`;

    const parsed = await callGroqJSON(systemPrompt, userPrompt);
    const rawQuestions = parsed.questions || parsed;

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0)
      return res.status(500).json({ message: 'Failed to generate exam. Please try again.' });

    const questions = rawQuestions.map(q => ({
      type: q.type || 'mcq',
      question: q.question || '',
      options: q.options || [],
      correctAnswer: q.correctAnswer || '',
      explanation: q.explanation || '',
      userAnswer: '',
      isCorrect: null,
      score: null,
      aiFeedback: '',
    }));

    const session = await ExamSession.create({
      userId: req.userId,
      examLevel,
      section,
      questions,
      totalScore: 0,
      maxScore: questions.length * 10,
      passed: false,
    });

    res.status(201).json({ session });
  } catch (err) { next(err); }
};

// ── Submit answers & grade ───────────────────────────────────────────────────
export const submitAnswers = async (req, res, next) => {
  try {
    const { sessionId, answers, timeSpentSeconds } = req.body;
    // answers = [{ questionId, userAnswer }]

    const session = await ExamSession.findOne({ _id: sessionId, userId: req.userId });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    let totalScore = 0;

    // Grade each question
    for (const ans of answers) {
      const q = session.questions.id(ans.questionId);
      if (!q) continue;
      q.userAnswer = ans.userAnswer;

      if (q.type === 'mcq' || q.type === 'fill') {
        // Exact/fuzzy match for MCQ and fill
        const correct = q.correctAnswer.toLowerCase().trim();
        const given = (ans.userAnswer || '').toLowerCase().trim();
        q.isCorrect = correct === given || given.includes(correct) || correct.includes(given);
        q.score = q.isCorrect ? 10 : 0;
        totalScore += q.score;
      } else if (q.type === 'speaking' || q.type === 'writing' || q.type === 'translate') {
        // AI grading for open-ended
        try {
          const feedback = await callGroq(
            `You are a strict but fair Goethe-Institut examiner grading a ${session.examLevel} exam.`,
            `Question: ${q.question}
Model answer: ${q.correctAnswer}
Student's answer: ${ans.userAnswer}

Grade this answer for the ${session.examLevel} Goethe exam. Respond with:
SCORE: X/10
FEEDBACK: [2-3 sentences: what was good, what needs improvement, specific correction]`
          );
          const scoreMatch = feedback.match(/SCORE:\s*(\d+)/i);
          q.score = scoreMatch ? Math.min(10, parseInt(scoreMatch[1])) : 5;
          q.aiFeedback = feedback.replace(/SCORE:\s*\d+\/10\s*/i, '').replace('FEEDBACK:', '').trim();
          q.isCorrect = q.score >= 6;
          totalScore += q.score;
        } catch {
          q.score = 0;
          q.isCorrect = false;
        }
      }
    }

    const maxScore = session.questions.length * 10;
    const percentage = (totalScore / maxScore) * 100;
    session.totalScore = totalScore;
    session.maxScore = maxScore;
    session.passed = percentage >= 60;
    session.completedAt = new Date();
    session.timeSpentSeconds = timeSpentSeconds || 0;
    await session.save();

    // XP reward
    const xpEarned = session.passed ? 50 : 20;
    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: xpEarned } });

    res.json({ session, xpEarned, percentage: Math.round(percentage) });
  } catch (err) { next(err); }
};

// ── Get exam history ─────────────────────────────────────────────────────────
export const getExamHistory = async (req, res, next) => {
  try {
    const sessions = await ExamSession.find({ userId: req.userId, completedAt: { $exists: true } })
      .sort({ completedAt: -1 })
      .limit(20)
      .select('-questions');
    res.json({ sessions });
  } catch (err) { next(err); }
};

// ── Get single session (with questions) ─────────────────────────────────────
export const getSession = async (req, res, next) => {
  try {
    const session = await ExamSession.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json({ session });
  } catch (err) { next(err); }
};

// ── AI Study Guide ───────────────────────────────────────────────────────────
export const getStudyGuide = async (req, res, next) => {
  try {
    const { examLevel, section } = req.params;

    const content = await callGroq(
      `You are an expert Goethe-Institut German teacher creating comprehensive study guides.
You write in clear, encouraging English with German examples.`,
      `Create a comprehensive study guide for the Goethe-Zertifikat ${examLevel} — ${section} section.

Structure the guide with:
## 📚 What You Need to Know
[key topics and skills for this section at ${examLevel}]

## 🎯 Exam Format
[exactly what to expect: question types, time limits, scoring]

## 📝 Core Content
[the most important vocabulary, grammar rules, or skills — use tables where helpful]

## 💡 Top Tips for ${examLevel} ${section}
[5 actionable strategies to score high]

## 🔄 Common Mistakes to Avoid
[3-5 typical errors at this level]

## 📖 Practice Example
[one worked example with explanation]

Be specific to ${examLevel} level. Use lots of German examples.`,
      2500
    );

    res.json({ content, examLevel, section });
  } catch (err) { next(err); }
};

// ── AI Conversation Partner ──────────────────────────────────────────────────
export const conversationTurn = async (req, res, next) => {
  try {
    const { examLevel, history, userMessage, scenario } = req.body;

    const scenarioDesc = {
      job_interview: 'a job interview in a German company',
      at_restaurant: 'ordering food at a German restaurant',
      at_doctor: 'a medical appointment in Germany',
      making_friends: 'meeting new people at a German cultural event',
      travel: 'asking for directions and help while travelling in Germany',
      shopping: 'shopping in a German store',
      phone_call: 'a formal phone call to a German office',
      exam_oral: 'the official Goethe oral exam with an examiner',
    }[scenario] || 'a general conversation in German';

    // Build conversation history for Groq
    const messages = [
      {
        role: 'system',
        content: `You are a native German speaker in the scenario: ${scenarioDesc}.
You are helping a ${examLevel} level learner prepare for the Goethe-Zertifikat oral exam.
Rules:
- Speak mostly in German appropriate for ${examLevel} level
- Keep sentences natural but comprehensible for ${examLevel}
- After your German reply, add: "💡 [one short English tip about what you said or the grammar used]"
- If the user makes a German error, gently correct it in parentheses: "(Correction: ...)"
- Be encouraging and natural, like a real conversation partner
- Keep responses concise (2-4 sentences in German)`
      },
      ...(history || []),
      { role: 'user', content: userMessage }
    ];

    const completion = await (await import('../config/groq.js')).default().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 400,
      temperature: 0.8,
      messages,
    });

    const reply = completion.choices[0]?.message?.content || '';
    res.json({ reply, role: 'assistant' });
  } catch (err) { next(err); }
};
