import { Router } from 'express';
import { z } from 'zod';
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
import { validateBody, validateQuery, validateParams } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { requireOwner } from '../middleware/requireOwner';
import { playerIdSchema } from '../utils/playerIdValidator';

const router = Router();

const playerIdParams = z.object({ playerId: playerIdSchema });

/**
 * GET /api/players
 *
 * Returns a filtered list of player profiles.
 * Supports optional query parameters for discovery.
 *
 * @query region {string} - Filter by player region (optional)
 * @query position {string} - Filter by playing position (optional)
 * @query minTier {number} - Minimum verified progress tier 0–3 (optional)
 * @response 200 { success: true, data: Player[] }
 * @auth none
 */
router.get('/', validateQuery(filterSchema), filterPlayers);
router.post(
  '/register',
  validateBody(registerSchema, { context: 'player_registration' }),
  registerPlayer
);
router.get('/:playerId', validateParams(playerIdParams), getPlayer);

/**
 * GET /api/players/:playerId/milestones
 *
 * Returns the tamper-proof milestone history for a player.
 *
 * @param playerId {string} - On-chain player identifier
 * @response 200 { success: true, data: Milestone[] }
 * @response 404 { success: false, error: string } - Player not found
 * @auth none
 */
router.get('/:playerId/milestones', validateParams(playerIdParams), getPlayerMilestones);
// Profile owner only — requireAuth sets req.account; requireOwner checks it matches :playerId
router.put(
  '/:playerId',
  validateParams(playerIdParams),
  requireAuth,
  requireOwner,
  validateBody(updatePlayerSchema),
  updatePlayer
);

export default router;
