import Library from '../models/Library.js';
import StoryLibrary from '../models/StoryLibrary.js';
── Upsert helper (called internally from other controllers) ──────────────────
// Increments `volume` if word already exists, otherwise inserts it.
export async function addWordsToLibrary(userId, words) {
  if (!words || words.length === 0) return;

  await Promise.allSettled(words.map(w =>
    Library.findOneAndUpdate(
      { userId, de: w.de.trim() },
      {
        $setOnInsert: {
          userId,
          de:           w.de.trim(),
          en:           w.en?.trim() || '',
          ipa:          w.ipa?.trim() || '',
          source:       w.source || 'grammar',
          partOfSpeech: w.partOfSpeech || w.category || 'unknown',
          gender:       w.gender?.trim() || '',
          plural:       w.plural?.trim() || '',
          conjugations: w.conjugations || undefined,
          comparative:  w.comparative?.trim() || '',
          superlative:  w.superlative?.trim() || '',
          example:      w.example?.trim() || '',
          exampleEn:    w.exampleEn?.trim() || '',
          tip:          w.tip?.trim() || '',
          category:     w.category?.trim() || '',
        },
        $inc: { volume: 1 },
      },
      { upsert: true, new: true }
    )
  ));
}

// ── GET /api/library ──────────────────────────────────────────────────────────
export const getLibrary = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 30,
      source,          // 'article' | 'grammar' | 'vocab'
      partOfSpeech,    // noun | verb | adjective ...
      search,          // free-text search on de/en
      sort = 'newest', // newest | oldest | az | za | volume
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(5, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    // Build filter
    const filter = { userId: req.userId };
    if (source)      filter.source      = source;
    if (partOfSpeech) filter.partOfSpeech = partOfSpeech;
    if (search?.trim()) {
      const re = new RegExp(search.trim(), 'i');
      filter.$or = [{ de: re }, { en: re }, { category: re }];
    }

    // Sort
    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt:  1 },
      az:     { de:  1 },
      za:     { de: -1 },
      volume: { volume: -1 },
    };
    const sortObj = sortMap[sort] || sortMap.newest;

    const [words, total] = await Promise.all([
      Library.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Library.countDocuments(filter),
    ]);

    // Summary stats
    const stats = await Library.aggregate([
      { $match: { userId: req.userId } },
      { $group: {
        _id: '$partOfSpeech',
        count: { $sum: 1 },
      }},
    ]);

    res.json({
      words,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      stats,
    });
  } catch (err) { next(err); }
};

// ── DELETE /api/library/:id ───────────────────────────────────────────────────
export const deleteWord = async (req, res, next) => {
  try {
    await Library.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Word removed from library' });
  } catch (err) { next(err); }
};

// ── GET /api/library/stats ────────────────────────────────────────────────────
export const getStats = async (req, res, next) => {
  try {
    const [byPos, bySource, total] = await Promise.all([
      Library.aggregate([
        { $match: { userId: req.userId } },
        { $group: { _id: '$partOfSpeech', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Library.aggregate([
        { $match: { userId: req.userId } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]),
      Library.countDocuments({ userId: req.userId }),
    ]);
    res.json({ total, byPartOfSpeech: byPos, bySource });
  } catch (err) { next(err); }
};

// ── Story Library ─────────────────────────────────────────────────────────────


function normTitle(title) {
  return title.toLowerCase().replace(/[^a-zäöüß0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// ── Helper: save a story, return true if NEW, false if duplicate ──────────────
export async function addStoryToLibrary(userId, { title, titleEn, level, topic, genre, source, passage, passageEn, vocabulary, refId }) {
  const titleKey = normTitle(title);
  try {
    const result = await StoryLibrary.findOneAndUpdate(
      { userId, titleKey },
      {
        $setOnInsert: { userId, title, titleEn, level, topic, genre, source, titleKey, passage, passageEn, vocabulary: vocabulary || [], refId },
        $inc: { generatedCount: 1 },
      },
      { upsert: true, new: true, rawResult: true }
    );
    // upserted = brand new doc
    return result.lastErrorObject?.upserted != null;
  } catch {
    return false;
  }
}

// ── Check if a title already exists for this user ────────────────────────────
export async function storyExistsInLibrary(userId, title) {
  const titleKey = normTitle(title);
  const doc = await StoryLibrary.findOne({ userId, titleKey }).lean();
  return !!doc;
}

// ── Load all past story titles so AI can avoid them ──────────────────────────
export async function getPastStoryTitles(userId) {
  const docs = await StoryLibrary.find({ userId }, 'title topic level').lean();
  return docs;
}

// ── GET /api/library/stories ─────────────────────────────────────────────────
export const getStoryLibrary = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, source, level, search, sort = 'newest' } = req.query;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(5, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const filter = { userId: req.userId };
    if (source) filter.source = source;
    if (level)  filter.level  = level;
    if (search?.trim()) {
      const re = new RegExp(search.trim(), 'i');
      filter.$or = [{ title: re }, { titleEn: re }, { topic: re }];
    }

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt:  1 },
      az:     { title: 1 },
      level:  { level: 1 },
    };

    const [stories, total] = await Promise.all([
      StoryLibrary.find(filter).sort(sortMap[sort] || sortMap.newest).skip(skip).limit(limitNum).lean(),
      StoryLibrary.countDocuments(filter),
    ]);

    res.json({
      stories,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) { next(err); }
};

// ── DELETE /api/library/stories/:id ──────────────────────────────────────────
export const deleteStory = async (req, res, next) => {
  try {
    await StoryLibrary.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Story removed from library' });
  } catch (err) { next(err); }
};
