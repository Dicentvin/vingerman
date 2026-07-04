import express from 'express';
import {
  generateReadingContent,
  processCustomText,
  getHistory,
  getSaved,
  readMaterial,
} from '../controllers/readAloudController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.post('/generate',       generateReadingContent);
router.post('/custom',         processCustomText);
router.post('/material',       readMaterial);
router.get('/history',         getHistory);
router.get('/:id',             getSaved);

export default router;
