import { Router } from 'express';
import { submitMilestoneEvidence, getPendingMilestones, rejectMilestone } from '../controllers/validatorController';
import { requireRole } from '../middleware/auth';

const router = Router();

router.post('/milestone', requireRole('validator'), submitMilestoneEvidence);
router.get('/milestones/pending', requireRole('validator'), getPendingMilestones);
router.post('/:wallet/milestones/:milestoneId/reject', requireRole('validator'), rejectMilestone);

export default router;
