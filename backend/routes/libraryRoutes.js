import express from 'express';
import { getLibrary, deleteWord, getStats, getStoryLibrary, deleteStory, getStoryById } from '../controllers/libraryController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

// Static routes FIRST (before any :param wildcards)
router.get('/stats',         getStats);
router.get('/stories',          getStoryLibrary);
router.get('/stories/:id/read', getStoryById);
router.delete('/stories/:id',   deleteStory);

// General word library
router.get('/',       getLibrary);
router.delete('/:id', deleteWord);

export default router;
