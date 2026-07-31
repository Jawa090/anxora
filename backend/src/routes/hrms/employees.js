const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const employeeController = require('../../controllers/hrms/employeeController');

const multerConfig = require('../../config/multer');
const upload = multerConfig.employees;

router.use(auth, requireOrg);

router.get('/', employeeController.getAll);
router.get('/stats', employeeController.getStats);
router.get('/:id', employeeController.getById);
router.get('/:id/documents', employeeController.getDocuments);
router.post('/', employeeController.create);
router.post('/:id/documents', upload.single('file'), employeeController.uploadDocument);
router.put('/:id', employeeController.update);
router.delete('/:id', employeeController.remove);
router.delete('/:id/documents/:docId', employeeController.deleteDocument);

module.exports = router;
