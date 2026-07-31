const express = require('express');
const router = express.Router();
const controller = require('../../controllers/crm/customFieldTemplateController');
const { auth } = require('../../middleware/auth');

router.get('/:entityType', auth, controller.getTemplates);
router.post('/:entityType', auth, controller.saveTemplates);

module.exports = router;
