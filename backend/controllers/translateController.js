import { callGroq } from '../config/groq.js';
import Translation from '../models/Translation.js';
import User from '../models/User.js';

export const translateText = async (req, res, next) => {
  try {
    const { text, direction = 'de-en' } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'Text is required' });

    const [from, to] = direction === 'de-en' ? ['German', 'English'] : ['English', 'German'];

    const translated = await callGroq(
      `You are an expert ${from}-${to} translator.
Provide ONLY the translation with no explanation, no preamble, no quotation marks around the result.`,
      `Translate this ${from} text to ${to}:\n\n${text}`
    );

    await Translation.create({ userId: req.userId, direction, original: text, translated: translated.trim() });
    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 5 } });

    res.json({ translated: translated.trim(), original: text, direction });
  } catch (err) { next(err); }
};

export const explainGrammar = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'Text is required' });

    const explanation = await callGroq(
      `You are an expert German grammar teacher who explains concepts clearly for English-speaking learners.
Use simple language, concrete examples, and memory tips.`,
      `Analyze the grammar of this German text: "${text}"

Explain the following where present:
1. 🔤 Verb conjugations (tense, person, irregular forms)
2. 📦 Grammatical cases used (Nominative / Accusative / Dative / Genitive)
3. 🔖 Articles (der/die/das and why)
4. 🔀 Word order rules (V2, SOV, subordinate clauses)
5. ⭐ Any special grammar points (separable verbs, modal verbs, etc.)
6. 💡 Memory tips for each point

Keep it practical and encouraging for learners!`
    );

    res.json({ explanation, text });
  } catch (err) { next(err); }
};
