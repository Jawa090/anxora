const express = require('express');
const router = express.Router();
const offerController = require('../../controllers/recruitment/offerController');
const { auth } = require('../../middleware/auth');

// All routes require authentication
router.use(auth);

// Offer Management Routes
router.post('/', offerController.createOffer);
router.get('/', offerController.getAllOffers);
router.get('/stats', offerController.getOfferStats);
router.get('/:id', offerController.getOfferById);
router.put('/:id/status', offerController.updateOfferStatus);
router.post('/:id/send', offerController.sendOfferLetter);
router.delete('/:id', offerController.deleteOffer);

module.exports = router;