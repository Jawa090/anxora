const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const {
  getAllInquiries,
  createInquiry,
  updateInquiry
} = require('../../controllers/inventory/carInquiriesController');

// All routes require authentication
router.use(auth);

router.get('/', getAllInquiries);
router.post('/', createInquiry);
router.put('/:id', updateInquiry);

module.exports = router;
