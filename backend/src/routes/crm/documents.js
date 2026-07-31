const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const documentController = require('../../controllers/crm/documentController');
const { getUploader } = require('../../utils/fileUpload');

// Use the dynamic uploader to save to public/uploads/crm
const upload = getUploader('crm', 20, 'document');

router.use(auth, requireOrg);

router.get('/:entityType/:entityId', documentController.getByEntity);
router.post('/upload-temp', upload.single('file'), documentController.uploadTemp);
router.post('/:entityType/:entityId', upload.single('file'), documentController.upload);
router.delete('/:id', documentController.remove);

module.exports = router;
