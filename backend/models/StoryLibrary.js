import mongoose from 'mongoose';

// Stores every unique story generated — shared by Story Reader & Comprehension
const storyLibrarySchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Identity
  title:   { type: String, required: true },
  titleEn: { type: String, default: '' },
  level:   { type: String, default: 'B1' },
  topic:   { type: String, default: '' },
  genre:   { type: String, default: 'story' },
  source:  { type: String, enum: ['story', 'comprehension'], required: true },

  // Dedupliation key: normalised title (lowercase, no punctuation)
  titleKey: { type: String, required: true },

  // Full content snapshot
  passage:    { type: String, default: '' },  // paragraph form (comprehension) or joined lines (story)
  passageEn:  { type: String, default: '' },

  vocabulary: [{ de: String, en: String, ipa: String, _id: false }],

  // How many times this exact title was attempted (volume)
  generatedCount: { type: Number, default: 1 },

  // Reference back to original document
  refId: { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

// Unique per user + normalised title
storyLibrarySchema.index({ userId: 1, titleKey: 1 }, { unique: true });
storyLibrarySchema.index({ userId: 1, source: 1 });
storyLibrarySchema.index({ userId: 1, level: 1 });
storyLibrarySchema.index({ userId: 1, createdAt: -1 });

const StoryLibrary = mongoose.models.StoryLibrary ||
  mongoose.model('StoryLibrary', storyLibrarySchema);
export default StoryLibrary;
