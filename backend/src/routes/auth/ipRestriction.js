const express = require('express');
const router = express.Router();
const { auth, requireOrg, requireAdmin } = require('../../middleware/auth');
const ipRestrictionController = require('../../controllers/auth/ipRestrictionController');

// All IP restriction management requires authentication and organization
router.use(auth, requireOrg);

// View settings (admins/managers/users can see office IP settings)
router.get('/', ipRestrictionController.getSettings);

// Admin-only management routes
router.post('/toggle', requireAdmin, ipRestrictionController.toggleRestriction);
router.post('/', requireAdmin, ipRestrictionController.addIp);
router.put('/:id', requireAdmin, ipRestrictionController.updateIp);
router.delete('/:id', requireAdmin, ipRestrictionController.deleteIp);

module.exports = router;
