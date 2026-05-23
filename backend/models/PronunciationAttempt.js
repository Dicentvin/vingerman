import mongoose from 'mongoose';

const pronunciationAttemptSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetPhrase: { type: String, required: true },
    spokenText:   { type: String, required: true },
    score:        { type: Number },
    feedback:     { type: String },
    audioUrl:     { type: String },
  },
  { timestamps: true }
);

const PronunciationAttempt = mongoose.model('PronunciationAttempt', pronunciationAttemptSchema);
export default PronunciationAttempt;
