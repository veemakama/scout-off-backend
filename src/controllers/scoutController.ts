import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getEvents, getPlayerById } from '../db';
import { submitContactPayment, purchaseSubscription, PaymentError } from '../services/stellar';
import { logger } from '../utils/logger';
import { isValidEvidenceUri } from './validatorController';
import { PaymentHistoryItem } from '../types';
import { getActiveSubscription } from '../utils/subscription';

async function logTrialOffer(scoutWallet: string, playerId: string, detailsUri: string) {
  // TODO: invoke log_trial_offer on the Soroban contract
  return { transactionId: `stub-trial-${Date.now()}`, playerId, detailsUri, playerTier: 3 };
}

export const trialOfferSchema = z.object({
  playerId: z.string().min(1),
  detailsUri: z.string().min(1).refine(isValidEvidenceUri, 'detailsUri must be a valid IPFS (ipfs://) or HTTPS URI'),
});

const subscribeSchema = z.object({
  tier: z.enum(['basic', 'premium']),
  duration: z.number().int().min(1).max(365),
});

/**
 * Returns true if the scout currently has paid access to the player —
 * either an active subscription or a previously unlocked contact.
 *
 * Uses the shared getActiveSubscription utility for the subscription check.
 */
async function scoutHasPlayerAccess(scoutWallet: string, playerId: string): Promise<boolean> {
  const sub = await getActiveSubscription(scoutWallet);
  if (sub.active) return true;

  return getEvents('contact_unlocked').some(
    (e) => e.payload.scout === scoutWallet && e.payload.player_id === playerId
  );
}

/** GET /api/scouts/:wallet/subscription */
export async function getSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    if (req.account !== wallet) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const sub = await getActiveSubscription(wallet);

    if (!sub.expiresAt && !sub.active) {
      // No subscription record found at all
      res.json({ success: true, data: { active: false, tier: null, expiresAt: null, remainingDays: 0 } });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const remainingDays =
      sub.active && sub.expiresAt != null
        ? Math.ceil((sub.expiresAt - now) / 86400)
        : 0;

    res.json({
      success: true,
      data: {
        active: sub.active,
        tier: sub.tier,
        expiresAt: sub.expiresAt,
        remainingDays,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/scouts/:wallet/contacts */
export async function getUnlockedContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    const { playerId } = req.query as { playerId?: string };

    if (req.account !== wallet) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    let contacts = getEvents('contact_unlocked').filter((e) => e.payload.scout === wallet);

    if (playerId) {
      contacts = contacts.filter((e) => e.payload.player_id === playerId);
    }

    res.json({
      success: true,
      data: contacts.map((e) => ({
        playerId: e.payload.player_id as string,
        contact_status: 'unlocked',
        unlockedAt: e.payload.unlocked_at as number,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/scouts/:wallet/contacts/:playerId/unlock */
export async function unlockContact(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet, playerId } = req.params;
    if (!wallet || !playerId) {
      res.status(400).json({ success: false, error: 'wallet and playerId are required' });
      return;
    }

    // Verify the JWT subject matches the wallet in the path
    if (req.account !== wallet) {
      logger.warn(`[scout] action=unlock_contact_denied scout=${wallet} playerId=${playerId} reason=wallet_mismatch`);
      res.status(403).json({ success: false, error: 'Forbidden: wallet does not match authenticated account' });
      return;
    }

    logger.info(`[scout] action=unlock_contact_attempt scout=${wallet} playerId=${playerId}`);

    const result = await submitContactPayment(wallet, playerId);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof PaymentError) {
      res.status(402).json({ success: false, error: err.message, code: err.code });
      return;
    }
    next(err);
  }
}

/** POST /api/scouts/:wallet/subscribe */
export async function subscribe(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    if (req.account !== wallet) {
      logger.warn(`[scout] action=subscribe_denied scout=${wallet} reason=wallet_mismatch`);
      res.status(403).json({ success: false, error: 'Forbidden: wallet does not match authenticated account' });
      return;
    }
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request body' });
      return;
    }
    const { tier, duration } = parsed.data;
    const result = await purchaseSubscription(wallet, tier, duration);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err instanceof PaymentError) {
      res.status(402).json({ success: false, error: err.message, code: err.code });
      return;
    }
    next(err);
  }
}

/** POST /api/scouts/:wallet/trial-offer */
export async function submitTrialOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    const { playerId, detailsUri } = req.body as { playerId: string; detailsUri: string };

    if (req.account !== wallet) {
      logger.warn(`[scout] action=log_trial_offer_denied scout=${wallet} playerId=${playerId} reason=wallet_mismatch`);
      res.status(403).json({ success: false, error: 'Forbidden: wallet does not match authenticated account' });
      return;
    }

    const playerExists = getEvents('player_registered').some((e) => e.payload.player_id === playerId);
    if (!playerExists) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const hasAccess = await scoutHasPlayerAccess(wallet, playerId);
    if (!hasAccess) {
      res.status(402).json({
        success: false,
        error: 'Scout must be subscribed or have paid the contact fee for this player',
      });
      return;
    }

    logger.info(`[scout] action=log_trial_offer_attempt scout=${wallet} playerId=${playerId}`);

    const result = await logTrialOffer(wallet, playerId, detailsUri);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err instanceof PaymentError) {
      res.status(402).json({ success: false, error: err.message, code: err.code });
      return;
    }
    next(err);
  }
}

/** GET /api/scouts/:wallet/payments — payment history derived from indexed events */
export async function getPaymentHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    const { from, to } = req.query as { from?: string; to?: string };

    // Derive payment history from indexed contact_unlocked events.
    // When tx_hash is absent from the event payload, transactionId is null
    // rather than fabricating a mock identifier.
    let payments: PaymentHistoryItem[] = getEvents('contact_unlocked')
      .filter((e) => e.payload.scout === wallet)
      .map((e) => ({
        transactionId: (e.payload.tx_hash as string | undefined) ?? null,
        amount: (e.payload.fee ?? '0') as string,
        token: 'XLM',
        timestamp: (e.payload.timestamp ?? new Date(0).toISOString()) as string,
      }));

    if (from) {
      const fromDate = new Date(from).getTime();
      payments = payments.filter((p) => new Date(p.timestamp).getTime() >= fromDate);
    }
    if (to) {
      const toDate = new Date(to).getTime();
      payments = payments.filter((p) => new Date(p.timestamp).getTime() <= toDate);
    }

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

/** GET /api/scouts/:wallet/contacts/:playerId */
export async function getContactDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet, playerId } = req.params;
    if (req.account !== wallet) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const player = getPlayerById(playerId);
    if (!player) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const hasUnlocked = getEvents('contact_unlocked').some(
      (e) => e.payload.scout === wallet && e.payload.player_id === playerId
    );

    if (!hasUnlocked) {
      res.status(403).json({ success: false, error: 'Contact not unlocked' });
      return;
    }

    res.json({
      success: true,
      data: {
        playerId: player.player_id,
        wallet: player.wallet,
        email: `${player.player_id}@example.com`,
        phone: '+1-555-0199',
      },
    });
  } catch (err) {
    next(err);
  }
}
