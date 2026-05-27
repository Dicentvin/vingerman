import express from 'express';
import { getDueCards, rateCard, syncFromVocab } from '../controllers/flashcardController.js';
import { protect } from '../middleware/authMiddleware.js';
const router = express.Router();
router.use(protect);
router.get('/due',    getDueCards);
router.post('/rate',  rateCard);
router.post('/sync',  syncFromVocab);
export default router;
