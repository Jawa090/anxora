const express = require('express');
const router = express.Router();
const { auth, requireOrg, requireAdminOrManager } = require('../../middleware/auth');
const wfhController = require('../../controllers/hrms/wfhController');

router.use(auth, requireOrg);

// List requests (personal or team depending on role/scope)
router.get('/', wfhController.getWfhRequests);

// Quick status check for today
router.get('/today-status', wfhController.getTodayWfhStatus);

// Create request
router.post('/', wfhController.createWfhRequest);

// Cancel request (employee or admin/manager for pending)
router.post('/:id/cancel', wfhController.cancelWfhRequest);

// Delete request (employee for pending/cancelled, admin/manager for any)
router.delete('/:id', wfhController.deleteWfhRequest);

// Approve or Reject (Super Admin, Admin, Manager only - enforced in controller)
router.patch('/:id/status', wfhController.updateWfhStatus);
router.put('/:id/status', wfhController.updateWfhStatus);

module.exports = router;
