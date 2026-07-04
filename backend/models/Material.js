import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema(
  {
    userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:              { type: String, required: true },
    originalName:       { type: String },
    fileType:           { type: String },
    cloudinaryUrl:      { type: String },
    cloudinaryPublicId: { type: String },
    fileSize:           { type: Number },
    extractedText:      { type: String },
  },
  { timestamps: true }
);

const Material = mongoose.model('Material', materialSchema);
export default Material;
