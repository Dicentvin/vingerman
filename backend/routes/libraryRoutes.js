import express from 'express';
import { getLibrary, deleteWord, getStats, getStoryLibrary, deleteStory } from '../controllers/libraryController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.get('/',       getLibrary);
router.get('/stats',  getStats);
router.delete('/:id', deleteWord);

// Story library
router.get('/stories',       getStoryLibrary);
router.delete('/stories/:id', deleteStory);

export default router;
