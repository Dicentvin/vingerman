import express from 'express';
import { getQueue, submitReview, getStats } from '../controllers/spacedRepController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.get('/queue',   getQueue);
router.get('/stats',   getStats);
router.post('/review', submitReview);

export default router;
