import mongoose from 'mongoose';

const vocabWordSchema = new mongoose.Schema({
  de:          { type: String, required: true },
  en:          { type: String, required: true },
  ipa:         { type: String, default: '' },
  example:     { type: String, default: '' },
  exampleEn:   { type: String, default: '' },
  mastered:    { type: Boolean, default: false },
  reviewCount: { type: Number, default: 0 },
});

const vocabListSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    topic:  { type: String, required: true },
    words:  [vocabWordSchema],
  },
  { timestamps: true }
);

const VocabList = mongoose.model('VocabList', vocabListSchema);
export default VocabList;
