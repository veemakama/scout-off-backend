import { Request, Response, NextFunction } from 'express';
import { getEvents } from '../services/indexer';
import { ok, normalizeTimestamps } from '../utils/response';

const SUBSCRIPTION_TS_FIELDS = ['expiry', 'subscription_expiry', 'subscriptionExpiry'];
const CONTACT_TS_FIELDS = ['unlocked_at', 'unlockedAt'];

/** GET /api/scouts/:wallet/subscription */
export async function getSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    const subs = getEvents('scout_subscribed').filter((e) => e.payload.scout === wallet);
    const latest = subs.at(-1);
    const data = latest ? normalizeTimestamps(latest.payload, SUBSCRIPTION_TS_FIELDS) : null;
    res.json(ok(data));
  } catch (err) {
    next(err);
  }
}

/** GET /api/scouts/:wallet/contacts */
export async function getUnlockedContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    const contacts = getEvents('contact_unlocked').filter((e) => e.payload.scout === wallet);
    res.json(ok(contacts.map((e) => normalizeTimestamps(e.payload, CONTACT_TS_FIELDS))));
  } catch (err) {
    next(err);
  }
}
