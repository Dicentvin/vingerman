import { callGroqJSON } from '../config/groq.js';
import VocabList from '../models/VocabList.js';
import User from '../models/User.js';

export const generateVocabList = async (req, res, next) => {
  try {
    const { topic, count = 12 } = req.body;
    if (!topic?.trim()) return res.status(400).json({ message: 'Topic is required' });

    const parsed = await callGroqJSON(
      `You are a German vocabulary teacher. You always respond with valid JSON only.`,
      `Generate ${count} essential German vocabulary words for the topic: "${topic}".

Return a JSON object with a "words" array. Each word object must have:
- "de": German word
- "en": English translation  
- "ipa": pronunciation in brackets like [hʊnt]
- "example": example sentence in German
- "example_en": English translation of the example sentence`
    );

    const rawWords = parsed.words || parsed;
    if (!Array.isArray(rawWords) || rawWords.length === 0)
      return res.status(500).json({ message: 'Failed to generate vocabulary. Please try again.' });

    const words = rawWords.map(w => ({
      de:        w.de || '',
      en:        w.en || '',
      ipa:       w.ipa || '',
      example:   w.example || '',
      exampleEn: w.example_en || w.exampleEn || '',
      mastered:  false,
      reviewCount: 0,
    }));

    const list = await VocabList.create({ userId: req.userId, topic, words });

    // Award XP
    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 10, wordsLearned: words.length } });

    res.status(201).json({ list });
  } catch (err) { next(err); }
};

export const getMyVocabLists = async (req, res, next) => {
  try {
    const lists = await VocabList.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ lists });
  } catch (err) { next(err); }
};

export const getVocabList = async (req, res, next) => {
  try {
    const list = await VocabList.findOne({ _id: req.params.id, userId: req.userId });
    if (!list) return res.status(404).json({ message: 'Vocab list not found' });
    res.json({ list });
  } catch (err) { next(err); }
};

export const markWordMastered = async (req, res, next) => {
  try {
    const { wordId, mastered } = req.body;

    const list = await VocabList.findOne({ 'words._id': wordId, userId: req.userId });
    if (!list) return res.status(404).json({ message: 'Word not found' });

    const word = list.words.id(wordId);
    word.mastered = mastered;
    await list.save();

    res.json({ word });
  } catch (err) { next(err); }
};

export const deleteVocabList = async (req, res, next) => {
  try {
    await VocabList.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Vocab list deleted' });
  } catch (err) { next(err); }
};
