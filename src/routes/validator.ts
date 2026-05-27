import { Router } from 'express';
import { submitMilestoneEvidence, getPendingMilestones } from '../controllers/validatorController';
import { requireRole } from '../middleware/auth';

const router = Router();

router.post('/milestone', requireRole('validator'), submitMilestoneEvidence);
router.get('/milestones/pending', requireRole('validator'), getPendingMilestones);

export default router;
