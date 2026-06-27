import { Router } from 'express';
import {
  registerPlayer,
  getPlayer,
  filterPlayers,
  getPlayerMilestones,
  updatePlayerRegion,
} from '../controllers/playerController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', filterPlayers);
router.post('/register', registerPlayer);
router.get('/:playerId', getPlayer);
router.patch('/:playerId/region', requireAuth, updatePlayerRegion);
router.get('/:playerId/milestones', getPlayerMilestones);

export default router;
