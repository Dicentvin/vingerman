import mongoose from 'mongoose';

const glossaryItemSchema = new mongoose.Schema({
  de:  { type: String },
  en:  { type: String },
  ipa: { type: String },
}, { _id: false });

const segmentSchema = new mongoose.Schema({
  text:        { type: String, required: true },
  translation: { type: String, default: '' },   // English translation of this segment
  note:        { type: String },
}, { _id: false });

const readAloudSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:    { type: String },
    level:    { type: String, default: 'A1' },
    type:     { type: String, default: 'story' },
    topic:    { type: String },
    fullText: { type: String },
    segments: [segmentSchema],
    glossary: [glossaryItemSchema],
  },
  { timestamps: true }
);

const ReadAloud = mongoose.model('ReadAloud', readAloudSchema);
export default ReadAloud;
