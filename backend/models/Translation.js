import mongoose from 'mongoose';

const translationSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    direction:  { type: String, enum: ['de-en', 'en-de'], required: true },
    original:   { type: String, required: true },
    translated: { type: String, required: true },
  },
  { timestamps: true }
);

const Translation = mongoose.model('Translation', translationSchema);
export default Translation;
