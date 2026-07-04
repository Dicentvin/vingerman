import express from 'express';
import { generateArticleSet, savePracticed, resetSeen, getHistory } from '../controllers/articleController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);
router.post('/generate',       generateArticleSet);
router.post('/practiced',      savePracticed);
router.delete('/reset/:topic', resetSeen);
router.get('/history',         getHistory);

export default router;
