import { Router } from 'express';
import {
  registerPlayer,
  getPlayer,
  filterPlayers,
  getPlayerMilestones,
  updatePlayer,
  registerSchema,
  filterSchema,
  updatePlayerSchema,
} from '../controllers/playerController';
import { validateBody, validateQuery } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { requireOwner } from '../middleware/requireOwner';

const router = Router();

router.get('/', validateQuery(filterSchema), filterPlayers);
router.post('/register', validateBody(registerSchema), registerPlayer);
router.get('/:playerId', getPlayer);
router.get('/:playerId/milestones', getPlayerMilestones);
// Profile owner only — requireAuth sets req.account; requireOwner checks it matches :playerId
router.put('/:playerId', requireAuth, requireOwner, validateBody(updatePlayerSchema), updatePlayer);

export default router;
