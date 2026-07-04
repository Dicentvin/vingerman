import express from 'express';
import {
  generateExam, submitAnswers, getExamHistory,
  getSession, getStudyGuide, conversationTurn,
} from '../controllers/examController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.post('/generate',       generateExam);
router.post('/submit',         submitAnswers);
router.get('/history',         getExamHistory);
router.get('/session/:id',     getSession);
router.get('/study/:examLevel/:section', getStudyGuide);
router.post('/conversation',   conversationTurn);

export default router;
