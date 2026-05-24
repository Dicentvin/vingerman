import mongoose from 'mongoose';

const studyMaterialSchema = new mongoose.Schema({
  examLevel: { type: String, enum: ['A1','A2','B1','B2','C1','C2'], required: true },
  section:   { type: String, enum: ['vocabulary','grammar','reading','writing','listening','speaking','culture'], required: true },
  title:     { type: String, required: true },
  content:   { type: String, required: true },  // rich markdown content
  keyPoints: [String],
  examples:  [{ de: String, en: String }],
  isBuiltIn: { type: Boolean, default: true },
}, { timestamps: true });

const StudyMaterial = mongoose.model('StudyMaterial', studyMaterialSchema);
export default StudyMaterial;
