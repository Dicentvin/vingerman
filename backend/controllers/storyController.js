import { callGroqJSON } from '../config/groq.js';
import { addStoryToLibrary, getPastStoryTitles } from './libraryController.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

// ── Model ─────────────────────────────────────────────────────────────────────
const storyLineSchema = new mongoose.Schema({
  line: { type: Number, required: true },
  de:   { type: String, required: true },
  en:   { type: String, required: true },
  note: { type: String, default: '' },
}, { _id: false });

const storySchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:      { type: String, required: true },
  titleEn:    { type: String, default: '' },
  level:      { type: String, default: 'A2' },
  topic:      { type: String, default: 'daily life' },
  genre:      { type: String, default: 'story' },
  lines:      [storyLineSchema],
  vocabulary: [{ de: String, en: String, ipa: String, _id: false }],
}, { timestamps: true });

const Story = mongoose.models.Story || mongoose.model('Story', storySchema);

// ── Level guides ──────────────────────────────────────────────────────────────
const LEVEL_GUIDES = {
  A1: 'ONLY the 500 most common German words. Max 5 words per sentence. Present tense only. Extremely simple.',
  A2: 'Simple vocabulary. Short sentences max 8 words. Mostly present tense, simple past for haben/sein.',
  B1: 'Intermediate vocabulary. Sentences up to 15 words. Mix of tenses. Some subordinate clauses.',
  B2: 'Upper-intermediate. Varied sentence length. All tenses. Some idiomatic expressions.',
  C1: 'Advanced vocabulary. Complex sentences. Full tense range. Natural native-like expression.',
};

const GENRE_DESCRIPTIONS = {
  story:      'a short narrative story with a clear beginning, middle, and end',
  dialogue:   'a realistic spoken conversation between two named people (format: Name: sentence)',
  adventure:  'an exciting adventure or journey story',
  humor:      'a funny lighthearted story with a surprise or joke ending',
  fairy_tale: 'a classic German fairy tale (Märchen) style story',
  news:       'a short news article written in journalistic style',
};

// ── Generate ──────────────────────────────────────────────────────────────────
export const generateStory = async (req, res, next) => {
  try {
    const { level = 'A2', topic = 'daily life', genre = 'story' } = req.body;
    const levelGuide = LEVEL_GUIDES[level] || LEVEL_GUIDES.A2;
    const genreDesc  = GENRE_DESCRIPTIONS[genre] || GENRE_DESCRIPTIONS.story;

    // Load past story titles so AI avoids repeating them
    const pastStories = await getPastStoryTitles(req.userId);
    const exclusionHint = pastStories.length > 0
      ? `\n\nCRITICAL — do NOT use any of these titles or the same storyline (user has already seen them):\n${pastStories.map(s => `"${s.title}" (${s.topic})`).slice(0, 50).join(', ')}`
      : '';

    const parsed = await callGroqJSON(
      `You are an expert German language teacher creating graded reading stories for learners.
Always respond with valid JSON only — no markdown, no preamble, no explanation outside the JSON.`,
      `Write ${genreDesc} in German for a ${level} level learner.

Topic: "${topic}"
Level guidance: ${levelGuide}

Requirements:
- Exactly 20 lines numbered 1 to 20
- Each line is one complete sentence (or one dialogue exchange for dialogues)
- Every line must have a German original AND an accurate English translation
- Notes are optional — only add when there is a genuinely useful grammar tip (max 60 chars)
- The story must be coherent, engaging and appropriate for ${level}
- Use a UNIQUE title and plot — do not repeat any story the user has seen before

Return ONLY a JSON object with this exact structure:
{
  "title": "Story title in German",
  "title_en": "English translation of the title",
  "lines": [
    {
      "line": 1,
      "de": "German sentence here",
      "en": "English translation here",
      "note": "optional grammar tip or empty string"
    }
  ],
  "vocabulary": [
    {
      "de": "key word from the story",
      "en": "English meaning",
      "ipa": "IPA pronunciation e.g. [ˈhaʊs]"
    }
  ]
}

- Produce EXACTLY 20 line objects numbered 1-20
- Vocabulary: 8-15 words from the story a ${level} learner should know
- Make it genuinely interesting to read, not just a list of sentences${exclusionHint}`
    );

    if (!parsed.lines || parsed.lines.length < 10) {
      return res.status(500).json({ message: 'Story generation returned incomplete content. Please try again.' });
    }

    const lines = parsed.lines.slice(0, 20).map((l, i) => ({
      line: l.line || i + 1,
      de:   String(l.de   || '').trim(),
      en:   String(l.en   || '').trim(),
      note: String(l.note || '').trim(),
    })).filter(l => l.de && l.en);

    const vocabulary = (parsed.vocabulary || []).map(v => ({
      de:  String(v.de  || '').trim(),
      en:  String(v.en  || '').trim(),
      ipa: String(v.ipa || '').trim(),
    })).filter(v => v.de && v.en);

    const title   = String(parsed.title    || `${genre} — ${topic}`).trim();
    const titleEn = String(parsed.title_en || '').trim();

    const story = await Story.create({
      userId: req.userId,
      title, titleEn, level, topic, genre, lines, vocabulary,
    });

    // Save to story library — deduplication happens inside addStoryToLibrary
    await addStoryToLibrary(req.userId, {
      title, titleEn, level, topic, genre,
      source:     'story',
      passage:    lines.map(l => l.de).join(' '),
      passageEn:  lines.map(l => l.en).join(' '),
      vocabulary,
      refId:      story._id,
    }).catch(() => {});

    await User.findByIdAndUpdate(req.userId, { $inc: { totalXP: 10 } });

    res.status(201).json({ story });
  } catch (err) { next(err); }
};

// ── History ────────────────────────────────────────────────────────────────────
export const getHistory = async (req, res, next) => {
  try {
    const history = await Story.find({ userId: req.userId })
      .select('title titleEn level genre topic createdAt')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ history });
  } catch (err) { next(err); }
};

// ── Get single story ───────────────────────────────────────────────────────────
export const getStory = async (req, res, next) => {
  try {
    const story = await Story.findOne({ _id: req.params.id, userId: req.userId });
    if (!story) return res.status(404).json({ message: 'Story not found' });
    res.json({ story });
  } catch (err) { next(err); }
};
