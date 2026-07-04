import express from 'express';
import { generateSentences, scoreAttempt } from '../controllers/coachController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.post('/sentences', generateSentences);
router.post('/score',     scoreAttempt);

export default router;
