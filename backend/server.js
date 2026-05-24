import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import connectDB from './config/db.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

// Routes
import authRoutes     from './routes/authRoutes.js';
import uploadRoutes   from './routes/uploadRoutes.js';
import podcastRoutes  from './routes/podcastRoutes.js';
import translateRoutes from './routes/translateRoutes.js';
import pronounceRoutes from './routes/pronounceRoutes.js';
import vocabRoutes    from './routes/vocabRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import examRoutes from './routes/examRoutes.js';



// Connect to MongoDB
connectDB();

const app = express();

app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.CLIENT_URL,
  ].filter(Boolean),
  credentials: true,
}))
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: 'mongodb', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth',      authRoutes);
app.use('/api/upload',    uploadRoutes);
app.use('/api/podcast',   podcastRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/pronounce', pronounceRoutes);
app.use('/api/vocab',     vocabRoutes);
app.use('/api/progress',  progressRoutes);
app.use('/api/exam',      examRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Deutsch Studio API on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  console.log(`📦 Database: MongoDB`);
  console.log(`🔑 Auth: JWT + bcrypt`);
});

export default app;
