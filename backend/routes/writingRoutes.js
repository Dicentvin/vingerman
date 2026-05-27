import express from 'express';
import { correctWriting, getWritingHistory } from '../controllers/writingController.js';
import { protect } from '../middleware/authMiddleware.js';
const router = express.Router();
router.use(protect);
router.post('/correct', correctWriting);
router.get('/history',  getWritingHistory);
export default router;
