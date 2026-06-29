import { Router } from 'express';
import { z } from 'zod';
import {
  getSubscription,
  getUnlockedContacts,
  unlockContact,
  getPaymentHistory,
  subscribeSchema,
  subscribeScout,
} from '../controllers/scoutController';
import { validateBody, validateParams } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { isValidStellarAddress } from '../utils/stellarAddress';
import { playerIdSchema } from '../utils/playerIdValidator';

const router = Router();

const walletParams = z.object({
  wallet: z.string().refine(isValidStellarAddress, {
    message: 'Invalid Stellar address',
  }),
});

const walletAndPlayerParams = z.object({
  wallet: walletParams.shape.wallet,
  playerId: playerIdSchema,
});

/**
 * GET /api/scouts/:wallet/subscription
 *
 * Returns the active subscription status for a scout wallet.
 *
 * @param wallet {string} - Scout's Stellar public key
 * @response 200 { success: true, data: { active: boolean, tier: string, expiresAt: string } }
 * @response 401 { success: false, error: string } - Missing or invalid token
 * @auth Bearer (any authenticated user)
 */
router.get('/:wallet/subscription', validateParams(walletParams), requireAuth, getSubscription);

/**
 * GET /api/scouts/:wallet/contacts
 *
 * Returns the list of player contacts unlocked by this scout.
 *
 * @param wallet {string} - Scout's Stellar public key
 * @response 200 { success: true, data: Contact[] }
 * @response 401 { success: false, error: string } - Missing or invalid token
 * @auth Bearer (any authenticated user)
 */
router.get('/:wallet/contacts', validateParams(walletParams), requireAuth, getUnlockedContacts);

/**
 * POST /api/scouts/:wallet/subscribe
 *
 * Creates or renews a scout subscription.
 *
 * @param wallet {string} - Scout's Stellar public key
 * @body duration {number} - Subscription duration in days (1-365)
 * @response 200 { success: true, data: { wallet: string, duration: number } }
 * @response 400 { success: false, error: string } - Invalid request body or route params
 * @auth Bearer (any authenticated user)
 */
router.post('/:wallet/subscribe', validateParams(walletParams), requireAuth, validateBody(subscribeSchema), subscribeScout);

/**
 * POST /api/scouts/:wallet/contacts/:playerId/unlock
 *
 * Records a pay-to-contact unlock for a player. The on-chain payment must be
 * completed via the Soroban pay_to_contact function before calling this endpoint.
 *
 * @param wallet {string} - Scout's Stellar public key
 * @param playerId {string} - Target player's on-chain identifier
 * @response 200 { success: true, data: Contact }
 * @response 401 { success: false, error: string } - Missing or invalid token
 * @auth Bearer (any authenticated user)
 */
router.post('/:wallet/contacts/:playerId/unlock', validateParams(walletAndPlayerParams), requireAuth, unlockContact);
router.get('/:wallet/payments', validateParams(walletParams), requireAuth, getPaymentHistory);

export default router;
