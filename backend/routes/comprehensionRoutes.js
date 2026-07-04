import express from 'express';
import {
  generateComprehension,
  submitAnswers,
  getComprehension,
  getHistory,
  deleteComprehension,
} from '../controllers/comprehensionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.post('/generate',     generateComprehension);
router.get('/history',       getHistory);
router.get('/:id',           getComprehension);
router.post('/:id/submit',   submitAnswers);
router.delete('/:id',        deleteComprehension);

export default router;
