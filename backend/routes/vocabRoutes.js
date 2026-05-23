import express from 'express';
import {
  generateVocabList, getMyVocabLists, getVocabList,
  markWordMastered, deleteVocabList,
} from '../controllers/vocabController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.post('/generate',     generateVocabList);
router.get('/',              getMyVocabLists);
router.get('/:id',           getVocabList);
router.put('/word/mastered', markWordMastered);
router.delete('/:id',        deleteVocabList);

export default router;
