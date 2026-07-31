const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const dmController = require('../../controllers/collaboration/directMessageController');

// All DM routes require authentication and organization context
router.use(auth, requireOrg);

// Get direct messages with a specific user
router.get('/:contact_user_id', dmController.getDirectMessages);

// Send a direct message
router.post('/', dmController.sendDirectMessage);

// Add/Remove a reaction
router.post('/:messageId/reactions', dmController.addReaction);

module.exports = router;
