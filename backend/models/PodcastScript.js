import mongoose from 'mongoose';

const podcastScriptSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
    style:      { type: String, default: 'educational' },
    script:     { type: String, required: true },
  },
  { timestamps: true }
);

const PodcastScript = mongoose.model('PodcastScript', podcastScriptSchema);
export default PodcastScript;
