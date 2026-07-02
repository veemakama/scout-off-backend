import { Router } from 'express';
import { getSubscription, getUnlockedContacts, getContactDetails, unlockContact, getPaymentHistory, subscribe, renewSubscription, cancelSubscription, submitTrialOffer, listTrialOffers, createTrialOffer, trialOfferSchema, unlockContactSchema } from '../controllers/scoutController';
import { getScoutRecommendations } from '../controllers/scoutRecommendationsController';
import { requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { walletRateLimit } from '../middleware/rateLimit';

const router = Router();

/**
 * GET /api/scouts/:wallet/subscription
 *
 * Returns the active subscription status for a scout wallet.
 * Response includes a `gracePeriodActive` boolean field.
 *
 * @param wallet {string} - Scout's Stellar public key
 * @response 200 { success: true, data: { active, tier, expiresAt, remainingDays, gracePeriodActive } }
 * @response 401 { success: false, error: string } - Missing or invalid token
 * @auth Bearer (scout role required)
 */
router.get('/:wallet/subscription', requireRole('scout'), getSubscription);

/**
 * POST /api/scouts/:wallet/subscribe
 *
 * Purchase a new scout subscription.
 *
 * @param wallet {string} - Scout's Stellar public key
 * @body { tier: 'basic' | 'premium', duration: number (1–365 days) }
 * @header Idempotency-Key {string} - Optional. Ensures safe retries: duplicate keys return
 *   the cached response for 24 hours without triggering a new on-chain transaction.
 * @response 201 { success: true, data: { transactionId, tier, expiresAt, status } }
 * @response 400 { success: false, error: string } - Invalid tier or duration
 * @response 402 { success: false, error: string } - Insufficient XLM balance
 * @response 403 { success: false, error: string } - Scout role required or wallet mismatch
 * @auth Bearer (scout role required)
 */
router.post("/:wallet/subscribe", requireRole("scout"), walletRateLimit(), subscribe);

/**
 * PUT /api/scouts/:wallet/subscribe
 *
 * Renew or create a subscription.
 * If an existing subscription exists, extends its expiry by `duration` days.
 * If no subscription exists, behaves like POST (creates a new one).
 *
 * @param wallet {string} - Scout's Stellar public key
 * @body { tier: 'basic' | 'premium', duration: number (1–365 days) }
 * @response 200 { success: true, data: { transactionId, tier, expiresAt, status } } - Renewal
 * @response 201 { success: true, data: { transactionId, tier, expiresAt, status } } - New subscription
 * @response 400 { success: false, error: string } - Invalid tier or duration
 * @response 402 { success: false, error: string } - Insufficient XLM balance
 * @response 403 { success: false, error: string } - Scout role required or wallet mismatch
 * @auth Bearer (scout role required)
 */
router.put("/:wallet/subscribe", requireRole("scout"), walletRateLimit(), renewSubscription);

router.get("/:wallet/contacts", requireRole("scout"), getUnlockedContacts);
router.get("/:wallet/contacts/:playerId", requireRole("scout"), getContactDetails);

/**
 * DELETE /api/scouts/:wallet/subscribe
 *
 * Cancel an active subscription. Records cancellation on-chain and locally.
 *
 * @param wallet {string} - Scout's Stellar public key
 * @response 200 { success: true, data: { transactionId, cancelledAt, wallet } }
 * @response 403 { success: false, error: string } - Scout role required or wallet mismatch
 * @response 404 { success: false, error: string } - No active subscription found
 * @auth Bearer (scout role required)
 */
router.delete('/:wallet/subscribe', requireRole('scout'), cancelSubscription);

/**
 * GET /api/scouts/:wallet/contacts
 */
router.get('/:wallet/contacts', requireRole('scout'), getUnlockedContacts);

/**
 * POST /api/scouts/:wallet/contacts/:playerId/unlock
 */
router.post(
  "/:wallet/contacts/:playerId/unlock",
  requireRole("scout"),
  walletRateLimit(),
  validateBody(unlockContactSchema),
  unlockContact,
);

router.get('/:wallet/payments', requireRole('scout'), getPaymentHistory);

/**
 * POST /api/scouts/:wallet/trial-offer
 */
router.post(
  '/:wallet/trial-offer',
  requireRole('scout'),
  validateBody(trialOfferSchema),
  submitTrialOffer,
);

/**
 * GET /api/scouts/:wallet/trial-offers
 * POST /api/scouts/:wallet/trial-offers
 *
 * On-chain trial offer event log (#285): submits (and lists) trial offers
 * indexed locally by tx_hash. Distinct from the singular /trial-offer stub
 * endpoint above and from the accept/reject workflow in trialOfferController.
 */
router.get('/:wallet/trial-offers', requireRole('scout'), listTrialOffers);
router.post(
  '/:wallet/trial-offers',
  requireRole('scout'),
  validateBody(trialOfferSchema),
  createTrialOffer,
);

/**
 * GET /api/scouts/:wallet/recommendations
 */
router.get(
  '/:wallet/recommendations',
  requireRole('scout'),
  getScoutRecommendations,
);

export default router;
