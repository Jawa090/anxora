const express = require('express');
const router = express.Router();
const requisitionController = require('../../controllers/recruitment/requisitionController');
const { auth } = require('../../middleware/auth');

// All routes require authentication
router.use(auth);

// Requisition routes
router.post('/', requisitionController.createRequisition);
router.get('/', requisitionController.getRequisitions);
router.get('/pending-approvals', requisitionController.getPendingApprovals);
router.get('/:id', requisitionController.getRequisitionById);
router.put('/:id/status', requisitionController.updateRequisitionStatus);
router.put('/:id', requisitionController.updateRequisition);
router.delete('/:id', requisitionController.deleteRequisition);
router.post('/bulk-delete', requisitionController.bulkDeleteRequisitions);

module.exports = router;
