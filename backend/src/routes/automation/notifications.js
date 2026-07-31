const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const c = require('../../controllers/automation/notificationsController');

router.use(auth, requireOrg);

// ── Unified notification endpoints ──────────────────────────────────────────
router.get('/', c.getAll);
router.get('/unread-count', c.getUnreadCount);
router.put('/read-all', c.markAllAsRead);
router.put('/:id/read', c.markAsRead);
router.delete('/', c.removeAll);
router.delete('/:id', c.remove);

// ── Legacy project-scoped (kept for backward compat) ────────────────────────
router.get('/project/:projectId', c.getByProject);
router.post('/project/:projectId', c.create);
router.put('/project/:projectId/read-all', c.markProjectAllAsRead);

module.exports = router;
