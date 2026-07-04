import express from 'express';
import {
  teachPronunciation, evaluatePronunciation, getPronunciationHistory,
} from '../controllers/pronounceController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.post('/teach',    teachPronunciation);
router.post('/evaluate', evaluatePronunciation);
router.get('/history',   getPronunciationHistory);

export default router;
