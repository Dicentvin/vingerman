import express from 'express';
import { getProgress, saveProgress } from '../controllers/syllabusController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);
router.get('/progress/:level',  getProgress);
router.post('/progress/:level', saveProgress);

export default router;
