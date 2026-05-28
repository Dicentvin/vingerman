import express from 'express';
import { generateQuestion, gradeAnswer, getHistory } from '../controllers/examPracticeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);
router.post('/generate', generateQuestion);
router.post('/grade',    gradeAnswer);
router.get('/history',   getHistory);

export default router;
