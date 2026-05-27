import express from 'express';
import { getTodayChallenge, submitChallenge, getLeaderboard } from '../controllers/challengeController.js';
import { protect } from '../middleware/authMiddleware.js';
const router = express.Router();
router.use(protect);
router.get('/today',       getTodayChallenge);
router.post('/submit',     submitChallenge);
router.get('/leaderboard', getLeaderboard);
export default router;
