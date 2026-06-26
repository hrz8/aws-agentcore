import { Router } from 'express';

const router = Router();

// Process is up and the event loop is responsive.
router.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

export default router;
