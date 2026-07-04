import { callGroq } from '../config/groq.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

const msgSchema = new mongoose.Schema({
  role:           { type: String, enum: ['user','assistant'] },
  content:        { type: String },
  correction:     { type: String },
  correctionNote: { type: String },
  timestamp:      { type: Date, default: Date.now },
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic:    { type: String },
  level:    { type: String, default: 'A2' },
  messages: [msgSchema],
}, { timestamps: true });

const ChatSession = mongoose.models.ChatSession || mongoose.model('ChatSession', sessionSchema);

export const startConversation = async (req, res, next) => {
  try {
    const { topic, level = 'A2' } = req.body;

    const levelGuide = {
      A1: 'Use ONLY very simple words. Short sentences max 6 words. Present tense only.',
      A2: 'Use simple vocabulary and short sentences. Present and simple past.',
      B1: 'Use intermediate vocabulary. Varied tenses. Some complex sentences.',
      B2: 'Use upper-intermediate language. Idiomatic expressions welcome.',
      C1: 'Use advanced, nuanced German. Complex structures, subjunctive, idioms.',
    };

    const opening = await callGroq(
      `You are a friendly German conversation tutor. You ONLY speak German (no English in your replies).
Level: ${level}. ${levelGuide[level] || levelGuide.A2}
Topic: ${topic}. Start the conversation naturally and warmly. Be encouraging.`,
      `Start a German conversation about: ${topic}. Keep it ${level} appropriate.`
    );

    const session = await ChatSession.create({
      userId: req.userId, topic, level,
      messages: [{ role: 'assistant', content: opening.trim(), timestamp: new Date() }],
    });

    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 5 } });

    res.json({
      sessionId: session._id,
      topic,
      opening: { role: 'assistant', content: opening.trim(), timestamp: new Date() },
    });
  } catch (err) { next(err); }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { sessionId, message, level = 'A2' } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'Message required' });

    const session = await ChatSession.findOne({ _id: sessionId, userId: req.userId });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    // Check user German + correct inline
    const correctionResult = await callGroq(
      `You are a German grammar checker. Given a student's German message, return ONLY a JSON object:
{"isCorrect": true/false, "corrected": "corrected version or same if correct", "note": "brief English explanation of main error (max 60 chars) or empty string"}
Do not add any text outside the JSON.`,
      `Student level: ${level}\nStudent wrote: "${message}"`
    );

    let correction = message, correctionNote = '';
    try {
      const clean = correctionResult.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (!parsed.isCorrect) {
        correction     = parsed.corrected || message;
        correctionNote = parsed.note || '';
      }
    } catch { /* keep original */ }

    // Build conversation history for context
    const history = session.messages.slice(-8).map(m => ({
      role: m.role, content: m.content,
    }));

    // Get AI reply — always in German
    const levelGuide = {
      A1: 'Reply in VERY simple German, max 6 words per sentence, present tense only.',
      A2: 'Reply in simple German, short sentences.',
      B1: 'Reply in clear intermediate German.',
      B2: 'Reply naturally in upper-intermediate German.',
      C1: 'Reply in fluent advanced German.',
    };

    const historyText = history.map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n');

    const reply = await callGroq(
      `You are a friendly German conversation tutor. ONLY use German in your responses (never English).
${levelGuide[level] || levelGuide.A2}
Topic: ${session.topic}. Keep the conversation natural and encouraging.`,
      `Conversation so far:\n${historyText}\nStudent: ${message}\n\nReply naturally in German:`
    );

    const userMsg  = { role: 'user',      content: message,      correction, correctionNote, timestamp: new Date() };
    const tutor    = { role: 'assistant', content: reply.trim(), timestamp: new Date() };

    session.messages.push(userMsg, tutor);
    await session.save();
    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 3 } });

    res.json({ userMessage: userMsg, reply: tutor });
  } catch (err) { next(err); }
};

export const getSessions = async (req, res, next) => {
  try {
    const sessions = await ChatSession.find({ userId: req.userId })
      .select('topic level messages createdAt')
      .sort({ createdAt: -1 }).limit(20);
    res.json({ sessions });
  } catch (err) { next(err); }
};

export const getSession = async (req, res, next) => {
  try {
    const session = await ChatSession.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ message: 'Not found' });
    res.json({ session });
  } catch (err) { next(err); }
};
