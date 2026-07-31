const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const { upload, detectFields, importContacts } = require('../../controllers/crm/contactImportController');

// Test route
router.get('/test', (req, res) => res.json({ message: 'Contact import routes working!' }));

// Upload file and detect fields
router.post('/detect-fields', auth, upload.single('file'), detectFields);

// Import contacts with field mapping
router.post('/', auth, importContacts);

module.exports = router;
