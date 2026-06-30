import { Request, Response, NextFunction } from 'express';
import { sanitizeInput } from '../utils/sanitizer';
import { z } from 'zod';
import { pinJson, gatewayUrl } from '../services/ipfs';
import { getEvents } from '../services/indexer';
import { invalidatePlayerCache } from '../services/cache';
import { ApiResponse, ProgressLevel } from '../types';
import { getTierMeta } from '../utils/tier';

export const registerSchema = z.object({
  wallet: z.string().min(56).max(56),
  position: z.string().min(1),
  region: z.string().min(1),
  metadata: z.record(z.unknown()),
});

export const filterSchema = z.object({
  region: z.string().optional(),
  position: z.string().optional(),
  minTier: z.coerce.number().int().min(0).max(3).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Returns the first player_registered event payload for the given playerId,
 * or undefined if no such player exists.
 */
export function getPlayerById(playerId: string): Record<string, unknown> | undefined {
  const events = getEvents('player_registered').filter(
    (e) => e.payload.player_id === playerId
  );
  return events.length ? events[0].payload : undefined;
}

/** POST /api/players/register */
export async function registerPlayer(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet, position, region, metadata } = registerSchema.parse(req.body);
    const sanitizedPosition = sanitizeInput(position);
    const sanitizedRegion = sanitizeInput(region);
    const cid = await pinJson({ wallet, position: sanitizedPosition, region: sanitizedRegion, ...metadata });
    // Invalidate player search cache so new profile appears in results
    invalidatePlayerCache();
    const body: ApiResponse<{ metadataUri: string; gatewayUrl: string }> = {
      success: true,
      data: { metadataUri: cid, gatewayUrl: gatewayUrl(cid) },
    };
    res.status(201).json(body);
  } catch (err) {
    next(err);
  }
}

/** GET /api/players/:playerId */
export async function getPlayer(req: Request, res: Response, next: NextFunction) {
  try {
    const playerId = sanitizeInput(req.params.playerId);
    const playerPayload = getPlayerById(playerId);
    if (!playerPayload) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }
    const level = (Number(playerPayload.progress_level ?? 0) as ProgressLevel);
    const { tierName, tierDescription } = getTierMeta(level);
    res.json({ success: true, data: { ...playerPayload, tierName, tierDescription } });
  } catch (err) {
    next(err);
  }
}

/** GET /api/players?region=&position=&minTier= */
export async function filterPlayers(req: Request, res: Response, next: NextFunction) {
  try {
    const { region, position, minTier, page, pageSize } = filterSchema.parse(req.query);
    const sanitizedRegion = region ? sanitizeInput(region) : undefined;
    const sanitizedPosition = position ? sanitizeInput(position) : undefined;
    let players = getEvents('player_registered').map((e) => e.payload);
    if (sanitizedRegion) players = players.filter((p) => p.region === sanitizedRegion);
    if (sanitizedPosition) players = players.filter((p) => p.position === sanitizedPosition);
    if (minTier !== undefined)
      players = players.filter((p) => Number(p.progress_level) >= minTier);
    const paginated = players.slice((page - 1) * pageSize, page * pageSize);
    res.json({ success: true, data: paginated, total: players.length, page, pageSize });
  } catch (err) {
    next(err);
  }
}

/** GET /api/players/:playerId/milestones */
export async function getPlayerMilestones(req: Request, res: Response, next: NextFunction) {
  try {
    const playerId = sanitizeInput(req.params.playerId);

    // Return 404 for a non-existent player so callers can distinguish
    // "player has no milestones yet" (200, data: []) from "player doesn't exist" (404).
    if (!getPlayerById(playerId)) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const milestones = getEvents('milestone_approved').filter(
      (e) => e.payload.player_id === playerId
    );
    res.json({ success: true, data: milestones });
  } catch (err) {
    next(err);
  }
}
