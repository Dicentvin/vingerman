import express from 'express';
import { generateWordSet, getTodaySet, markPracticed, getHistory } from '../controllers/grammarController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);
router.post('/generate',   generateWordSet);
router.get('/today',       getTodaySet);
router.post('/practiced',  markPracticed);
router.get('/history',     getHistory);

export default router;
