import express from 'express';
import { translateText, explainGrammar } from '../controllers/translateController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.post('/',        translateText);
router.post('/grammar', explainGrammar);

export default router;
