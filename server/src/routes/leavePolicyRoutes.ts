import { Router } from 'express';
import type { Response } from 'express';
import { authenticateToken, authorizeAccess, type AuthRequest } from '../middleware/auth';
import { getLeavePolicy, updateLeavePolicy } from '../utils/leavePolicy';

// The leave policy numbers: notice period and the two per-contract allowances.
//
// Readable by anyone signed in — the leave request screen has to know the notice window to warn
// about it, and every employee uses that screen.
//
// Editable only with manage_leave_policy. NOT manage_leaves, which it used to be: that permission
// is a position default for every head from Unit upward, so setting the company's leave rules was
// open to anyone who could approve a leave request. These are company-wide configuration numbers,
// so the gate is its own Administration permission and is deliberately NOT OR'd with manage_leaves.
const router = Router();
router.use(authenticateToken);

router.get('/', async (_req, res: Response) => {
    try {
        res.json(await getLeavePolicy());
    } catch (error) {
        console.error('Error reading leave policy:', error);
        res.status(500).json({ error: 'Failed to read the leave policy.' });
    }
});

router.patch('/', authorizeAccess([], ['manage_leave_policy']), async (req: AuthRequest, res: Response) => {
    try {
        const { noticeDays, emergencyLeaveAllowance, unpaidLeaveAllowance } = req.body ?? {};
        res.json(await updateLeavePolicy({ noticeDays, emergencyLeaveAllowance, unpaidLeaveAllowance }, req.user?.id));
    } catch (error) {
        console.error('Error updating leave policy:', error);
        res.status(500).json({ error: 'Failed to update the leave policy.' });
    }
});

export default router;
