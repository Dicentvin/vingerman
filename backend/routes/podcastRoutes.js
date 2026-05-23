import express from 'express';
import { generatePodcast, getPodcastHistory } from '../controllers/podcastController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.post('/generate', generatePodcast);
router.get('/history',   getPodcastHistory);

export default router;
