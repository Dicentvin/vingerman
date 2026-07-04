import express from 'express';
import { generateMockExam, submitMockExam, getMockExam, getMockExamHistory, deleteMockExam } from '../controllers/mockExamController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.post('/generate',    generateMockExam);
router.get('/history',      getMockExamHistory);
router.get('/:id',          getMockExam);
router.post('/:id/submit',  submitMockExam);
router.delete('/:id',       deleteMockExam);

export default router;
