import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getUserDashboard } from '../services/dashboard.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const payload = await getUserDashboard(req.authUser!.id);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});
