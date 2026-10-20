import mongoose from 'mongoose';

// Every word the Grammar Drill ever generates is stored here (one row per user + word),
// so the Saved Words table can be read at any time without regenerating.
const grammarWordSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  key:          { type: String, required: true },            // "verb:gehen"
  de:           { type: String, required: true },
  en:           { type: String, default: '' },
  category:     { type: String, required: true, index: true },
  ipa:          { type: String, default: '' },
  gender:       { type: String, default: '' },
  plural:       { type: String, default: '' },
  conjugations: { type: mongoose.Schema.Types.Mixed, default: null },
  comparative:  { type: String, default: '' },
  superlative:  { type: String, default: '' },
  example:      { type: String, default: '' },
  exampleEn:    { type: String, default: '' },
  sentences:    { type: [String], default: [] },
  sentencesEn:  { type: [String], default: [] },
  tip:          { type: String, default: '' },
  tenseExamples:{ type: mongoose.Schema.Types.Mixed, default: null },   // verbs: present/past/future
  setId:        { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

grammarWordSchema.index({ userId: 1, key: 1 }, { unique: true });
grammarWordSchema.index({ userId: 1, category: 1, createdAt: -1 });

export default mongoose.models.GrammarWord || mongoose.model('GrammarWord', grammarWordSchema);
