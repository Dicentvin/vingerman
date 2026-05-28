import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

import authRoutes      from './routes/authRoutes.js';
import uploadRoutes    from './routes/uploadRoutes.js';
import podcastRoutes   from './routes/podcastRoutes.js';
import translateRoutes from './routes/translateRoutes.js';
import pronounceRoutes from './routes/pronounceRoutes.js';
import vocabRoutes     from './routes/vocabRoutes.js';
import progressRoutes  from './routes/progressRoutes.js';
import readAloudRoutes from './routes/readAloudRoutes.js';
import writingRoutes   from './routes/writingRoutes.js';
import flashcardRoutes from './routes/flashcardRoutes.js';
import chatRoutes      from './routes/chatRoutes.js';
import challengeRoutes from './routes/challengeRoutes.js';
import syllabusRoutes  from './routes/syllabusRoutes.js';
import examPracticeRoutes from './routes/examPracticeRoutes.js';

dotenv.config();
connectDB();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', db: 'mongodb', ts: new Date().toISOString() }));

app.use('/api/auth',       authRoutes);
app.use('/api/upload',     uploadRoutes);
app.use('/api/podcast',    podcastRoutes);
app.use('/api/translate',  translateRoutes);
app.use('/api/pronounce',  pronounceRoutes);
app.use('/api/vocab',      vocabRoutes);
app.use('/api/progress',   progressRoutes);
app.use('/api/readaloud',  readAloudRoutes);
app.use('/api/writing',    writingRoutes);
app.use('/api/flashcard',  flashcardRoutes);
app.use('/api/chat',       chatRoutes);
app.use('/api/challenge',  challengeRoutes);
app.use('/api/syllabus',   syllabusRoutes);
app.use('/api/exam',       examPracticeRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Deutsch Studio API — port ${PORT}`);
  console.log(`📦 MongoDB · 🔑 JWT · 🤖 Groq · 14 routes registered`);
});

export default app;
