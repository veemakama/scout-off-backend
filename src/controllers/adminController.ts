import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getEvents } from '../services/indexer';
import { ok, paginated } from '../utils/response';

const eventsQuerySchema = z.object({
  playerId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** GET /api/admin/events */
export async function getAllEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const { playerId, page, pageSize } = eventsQuerySchema.parse(req.query);
    let events = getEvents();
    if (playerId) {
      events = events.filter((e) => e.payload.player_id === playerId);
    }
    const slice = events.slice((page - 1) * pageSize, page * pageSize);
    res.json(paginated(slice, events.length, page, pageSize));
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/fees */
export async function getFeeSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const withdrawals = getEvents('fees_withdrawn').map((e) => e.payload);
    res.json(ok(withdrawals));
  } catch (err) {
    next(err);
  }
}
