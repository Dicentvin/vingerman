import mongoose from 'mongoose';

const syllabusProgressSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  level:            { type: String, enum: ['A1', 'A2'], required: true },
  completedTopics:  [{ type: String }],
  completedGrammar: [{ type: String }],
  lastUpdated:      { type: Date, default: Date.now },
}, { timestamps: true });

syllabusProgressSchema.index({ userId: 1, level: 1 }, { unique: true });

const SyllabusProgress = mongoose.models.SyllabusProgress ||
  mongoose.model('SyllabusProgress', syllabusProgressSchema);

export const getProgress = async (req, res, next) => {
  try {
    const { level } = req.params;
    if (!['A1', 'A2'].includes(level))
      return res.status(400).json({ message: 'Invalid level' });

    const doc = await SyllabusProgress.findOne({ userId: req.userId, level });
    res.json({
      progress: doc
        ? { completedTopics: doc.completedTopics, completedGrammar: doc.completedGrammar }
        : { completedTopics: [], completedGrammar: [] },
    });
  } catch (err) { next(err); }
};

export const saveProgress = async (req, res, next) => {
  try {
    const { level } = req.params;
    if (!['A1', 'A2'].includes(level))
      return res.status(400).json({ message: 'Invalid level' });

    const { completedTopics = [], completedGrammar = [] } = req.body;

    const doc = await SyllabusProgress.findOneAndUpdate(
      { userId: req.userId, level },
      { completedTopics, completedGrammar, lastUpdated: new Date() },
      { upsert: true, new: true }
    );

    res.json({ progress: { completedTopics: doc.completedTopics, completedGrammar: doc.completedGrammar } });
  } catch (err) { next(err); }
};
