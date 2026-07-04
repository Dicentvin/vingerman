import User from '../models/User.js';
import PronunciationAttempt from '../models/PronunciationAttempt.js';
import Translation from '../models/Translation.js';
import VocabList from '../models/VocabList.js';
import PodcastScript from '../models/PodcastScript.js';

export const getProgress = async (req, res, next) => {
  try {
    const [user, pronunciationCount, translationCount, vocabCount, podcastCount] = await Promise.all([
      User.findById(req.userId),
      PronunciationAttempt.countDocuments({ userId: req.userId }),
      Translation.countDocuments({ userId: req.userId }),
      VocabList.countDocuments({ userId: req.userId }),
      PodcastScript.countDocuments({ userId: req.userId }),
    ]);

    res.json({
      stats: {
        totalXP:              user?.totalXP || 0,
        streak:               user?.streak || 0,
        level:                user?.level || 'A1',
        wordsLearned:         user?.wordsLearned || 0,
        podcastsGenerated:    podcastCount,
        translationsDone:     translationCount,
        pronunciationSessions: pronunciationCount,
        vocabLists:           vocabCount,
      },
    });
  } catch (err) { next(err); }
};
