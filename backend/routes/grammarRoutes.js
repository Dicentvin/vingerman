import express from 'express';
import {
  generateWordSet, getTodaySet, markPracticed, getHistory, verbTenses,
  listSavedWords, deleteSavedWord, listSavedVerbs,
} from '../controllers/grammarController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);
router.post('/generate',     generateWordSet);
router.get('/today',         getTodaySet);
router.post('/practiced',    markPracticed);
router.get('/history',       getHistory);
router.post('/verb-tenses',  verbTenses);
router.get('/words',         listSavedWords);
router.delete('/words/:id',  deleteSavedWord);
router.get('/verbs',         listSavedVerbs);

export default router;
