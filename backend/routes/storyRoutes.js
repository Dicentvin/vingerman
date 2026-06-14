import express from 'express';
import { generateStory, getHistory, getStory } from '../controllers/storyController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);
router.post('/generate', generateStory);
router.get('/history',   getHistory);
router.get('/:id',       getStory);

export default router;
