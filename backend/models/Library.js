import mongoose from 'mongoose';

// One document per unique word per user
const libraryWordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Core word data
  de:       { type: String, required: true },   // German word (with article for nouns)
  en:       { type: String, required: true },   // English meaning
  ipa:      { type: String, default: '' },

  // Classification
  source:   { type: String, enum: ['article', 'grammar', 'vocab'], required: true },
  partOfSpeech: {
    type: String,
    enum: ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'mixed', 'unknown'],
    default: 'unknown',
  },

  // Noun-specific
  gender:  { type: String, default: '' },   // der/die/das
  plural:  { type: String, default: '' },

  // Verb-specific
  conjugations: {
    ich: String, du: String, er: String,
    wir: String, ihr: String, sie: String,
  },

  // Adjective-specific
  comparative: { type: String, default: '' },
  superlative: { type: String, default: '' },

  // Example
  example:   { type: String, default: '' },
  exampleEn: { type: String, default: '' },
  tip:       { type: String, default: '' },
  category:  { type: String, default: '' },   // topic/sub-category

  // Usage tracking
  volume: { type: Number, default: 1 },   // how many times this word appeared in generations
}, { timestamps: true });

// Unique per user + exact German word
libraryWordSchema.index({ userId: 1, de: 1 }, { unique: true });
libraryWordSchema.index({ userId: 1, source: 1 });
libraryWordSchema.index({ userId: 1, partOfSpeech: 1 });
libraryWordSchema.index({ userId: 1, createdAt: -1 });

const Library = mongoose.models.Library || mongoose.model('Library', libraryWordSchema);
export default Library;
