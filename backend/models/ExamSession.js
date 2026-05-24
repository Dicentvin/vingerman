import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  type:        { type: String, enum: ['mcq','fill','translate','listening','speaking','writing'], required: true },
  question:    { type: String, required: true },
  options:     [String],                   // for MCQ
  correctAnswer: { type: String, required: true },
  explanation: String,
  userAnswer:  String,
  isCorrect:   Boolean,
  score:       Number,                     // 0-10 for open-ended
  aiFeedback:  String,
}, { _id: true });

const examSessionSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  examLevel:   { type: String, enum: ['A1','A2','B1','B2','C1','C2'], required: true },
  section:     { type: String, enum: ['reading','writing','listening','speaking','vocabulary','grammar','full'], required: true },
  questions:   [questionSchema],
  totalScore:  Number,
  maxScore:    Number,
  passed:      Boolean,
  completedAt: Date,
  timeSpentSeconds: Number,
}, { timestamps: true });

const ExamSession = mongoose.model('ExamSession', examSessionSchema);
export default ExamSession;
