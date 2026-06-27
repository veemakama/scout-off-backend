import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Keypair } from '@stellar/stellar-sdk';
import { pinJson } from '../services/ipfs';
import { getEvents } from '../services/indexer';
import { invokeContract, strVal } from '../utils/contract';
import config from '../config';

const rejectSchema = z.object({
  reason: z.string().min(1),
});

const milestoneSchema = z.object({
  playerId: z.string().min(1),
  milestoneType: z.enum(['identity', 'performance', 'trial_offer']),
  evidenceUri: z.string().min(1),
});

const pendingQuerySchema = z.object({
  region: z.string().optional(),
  playerId: z.string().optional(),
});

/** POST /api/validators/milestone */
export async function submitMilestoneEvidence(req: Request, res: Response, next: NextFunction) {
  try {
    const { playerId, milestoneType, evidenceUri } = milestoneSchema.parse(req.body);
    const evidenceCid = await pinJson({ playerId, milestoneType, evidenceUri });
    res.status(201).json({ success: true, data: { evidenceCid } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/validators/:wallet/milestones/:milestoneId/reject */
export async function rejectMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet, milestoneId } = req.params;

    if ((req as any).account !== wallet) {
      res.status(403).json({ success: false, error: 'Wallet mismatch' });
      return;
    }

    const { reason } = rejectSchema.parse(req.body);

    const exists = getEvents('milestone_submitted').some(
      (e) => e.payload.milestone_id === milestoneId
    );
    if (!exists) {
      res.status(404).json({ success: false, error: 'Milestone not found' });
      return;
    }

    const keypair = Keypair.fromSecret(config.platformSecret);
    await invokeContract(keypair, 'reject_milestone', [
      strVal(wallet),
      strVal(milestoneId),
      strVal(reason),
    ]);

    res.json({ success: true, data: { milestoneId, reason } });
  } catch (err) {
    next(err);
  }
}

/** GET /api/validators/milestones/pending */
export async function getPendingMilestones(req: Request, res: Response, next: NextFunction) {
  try {
    const { region, playerId } = pendingQuerySchema.parse(req.query);
    const submitted = getEvents('milestone_submitted').map((e) => e.payload);
    const approvedIds = new Set(
      getEvents('milestone_approved').map((e) => e.payload.milestone_id)
    );
    let pending = submitted.filter((m) => !approvedIds.has(m.milestone_id));
    if (region) pending = pending.filter((m) => m.region === region);
    if (playerId) pending = pending.filter((m) => m.playerId === playerId || m.player_id === playerId);
    res.json({ success: true, data: pending });
  } catch (err) {
    next(err);
  }
}
