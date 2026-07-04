import { callGroq } from '../config/groq.js';
import PronunciationAttempt from '../models/PronunciationAttempt.js';
import User from '../models/User.js';

export const teachPronunciation = async (req, res, next) => {
  try {
    const { word } = req.body;
    if (!word?.trim()) return res.status(400).json({ message: 'Word or phrase is required' });

    const lesson = await callGroq(
      `You are a friendly and encouraging German pronunciation coach for English speakers.
You explain sounds clearly using familiar English sound comparisons.`,
      `Teach me how to pronounce this German word or phrase: "${word}"

Provide a complete pronunciation lesson with:
1. 🔤 IPA phonetic transcription
2. 🗣️ Syllable-by-syllable English sound guide (e.g. "ent-SHOOL-dee-goong")
3. 👄 Mouth and tongue position tips for tricky sounds
4. ⚠️  Common mistakes English speakers make
5. 📝 A sample sentence using this word/phrase
6. 🧠 A memory trick to remember the pronunciation

Be warm, practical and encouraging!`
    );

    res.json({ lesson, word });
  } catch (err) { next(err); }
};

export const evaluatePronunciation = async (req, res, next) => {
  try {
    const { targetPhrase, spokenText, audioUrl } = req.body;
    if (!targetPhrase || !spokenText)
      return res.status(400).json({ message: 'Target phrase and spoken text are required' });

    const feedback = await callGroq(
      `You are an expert German pronunciation coach.
You give specific, constructive, and encouraging feedback to help learners improve.
Note: the student's speech was captured via speech-to-text which may not perfectly capture German phonemes.`,
      `Target German phrase: "${targetPhrase}"
Student's speech-to-text result: "${spokenText}"

Evaluate the student's pronunciation attempt and provide:
1. ✅ What they got right (be specific and encouraging)
2. ❌ Specific pronunciation errors detected
3. 🔄 Exactly how to fix each error (mouth position, tongue placement, breath)
4. 📊 Overall pronunciation score: X/10 (be fair, note STT limitations)
5. 💡 The single most important improvement tip

Remember: speech-to-text may distort German sounds, so give benefit of the doubt.
Be encouraging — learning a language is hard!`
    );

    const scoreMatch = feedback.match(/(\d+)\s*(?:\/|out of)\s*10/i);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

    await PronunciationAttempt.create({
      userId: req.userId, targetPhrase, spokenText, score, feedback,
      audioUrl: audioUrl || null,
    });

    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 15 } });

    res.json({ feedback, score, targetPhrase, spokenText });
  } catch (err) { next(err); }
};

export const getPronunciationHistory = async (req, res, next) => {
  try {
    const attempts = await PronunciationAttempt.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ attempts });
  } catch (err) { next(err); }
};
